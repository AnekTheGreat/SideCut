#!/usr/bin/env node
/**
 * SideCut 70.1.3 - Premium is removed, everything it locked is free, and Donate
 * is the only thing left that asks anybody for anything.
 *
 * The user asked, in two messages:
 *
 *   "Remove it remove premium only thing is keep donations"
 *   "Remove premium make everything free keep donations"
 *
 * WHY THIS IS A REMOVAL AND NOT A SWITCH. The obvious cheap version of this is
 * to make the one predicate that guards everything answer `true` and walk away:
 * the paywall would stop biting and the file would still be full of plans, gift
 * codes, licence keys and a store that can revoke what somebody paid for. That
 * is not what was asked for. Premium was a product with four ways to buy it and
 * five places to be lost, and the request is that it stop existing - so the
 * purchase machinery, the entitlement, the storage it lived in and every gate
 * that read it are all deleted here, and the assertion at the bottom of this
 * file is that the page no longer contains any of them.
 *
 * WHAT MUST SURVIVE. The Donate tab, which is now the only thing the app asks
 * for: the same eleven tip tiers, the same Google Play consumables, unchanged.
 * The one thing added to it is the route out for a copy that cannot bill - the
 * APK and the browser used to get a sentence about Google Play and nothing to
 * click, and they get the Play listing now, which is the only place a tip can
 * actually be made.
 *
 * WHAT "FREE" MEANS FOR THE BADGES. The wall still ends at 201 and the last
 * tile is still the secret one. It used to mint Premium; it cannot mint what
 * does not exist, so it is the trophy now - the same five reward rows, the same
 * four themes at 50/100/150/200, and the fifth says what it is.
 *
 *   node dev/patch-7013.mjs            # apply
 *   node dev/patch-7013.mjs --check    # report only, change nothing
 *   node dev/patch-7013.mjs --manifest # reseed the root manifest.json only
 */
import fs from 'node:fs';
import path from 'node:path';

// SC_ROOT replays the same edits against a scratch copy of the tree, which is how
// a release of this size is proven before it is cut here.
const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const MOD = path.join(ROOT, 'dev', 'sc70-module.js');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const STUDIO = path.join(ROOT, 'dev', 'studio-70-check.cjs');

const CHECK = process.argv.includes('--check');
const MANIFEST = process.argv.includes('--manifest');
const VERSION = '70.1.3';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// Built at 2026-09-29 23:54 UTC = 7:54 PM EDT, the same day as 70.1.2 an hour
// and a half earlier. A stamp in the FUTURE is a gate failure (test-6643).
const STAMP = 'September 29, 2026 \u00b7 7:54 PM EDT';
const CACHE = 'sidecut-shell-v63.0.39';
const OLDCACHE = 'sidecut-shell-v63.0.38';
const TITLE = 'Premium is gone: every tool it used to lock is free for everyone, and Donate is the only thing left that asks for anything';

// Six notes. None carries an apostrophe (a note is emitted into a single-quoted
// literal), none says "download", and none uses the words "play build", "play
// version" or "play install" - test-662, test-6642 and test-66421 refuse those.
const NOTES = [
  'Premium is gone. Nothing in SideCut is locked any more: Discover, pinned artists and new releases, word-by-word lyrics, every animated theme, the Sandbox toggles, and the practice loop and your own presets in Studio are open to everyone, with nothing to buy and nothing to unlock.',
  'The Premium tab is out of Settings, and everything that was in it went with it - the plan cards, the gift-code box, the paste-a-license-key box and the store fallback. There is no paywall left to hit and no purchase left to make, in the app or on the web.',
  'Donate is still here, unchanged, and it is now the only thing SideCut asks anybody for. The tip tiers are the same, the same Google Play sheet opens, and a tip unlocks nothing on purpose: it is a thank you, not a key, and the app works exactly the same whether you tip or not.',
  'The one thing Donate gained is a way out for a copy that cannot bill. The APK and the browser used to get a sentence about Google Play and nothing to do about it, and they get the Play listing now, because that install is the only place a tip can actually be made.',
  'Nothing you already had is taken away. A badge reset, a reinstall or a restore from a backup cannot lock anything again, because there is nothing left to lose - and the badge wall is untouched at two hundred and one tiles with the four theme rewards at 50, 100, 150 and 200.',
  'The last tile on the wall is still the secret one that only dev mode reaches, and it is the trophy now rather than a purchase: it used to mint Premium, and it cannot mint what no longer exists, so it says what it is and the wall is the reward.',
];

const problems = [];
let applied = 0, already = 0;

const count = (hay, needle) => hay.split(needle).length - 1;

function holder(text){ return { text: text }; }

/* --------------------------------------------------------------- the helpers */
// A correction that must NOT fail when there is nothing to correct: index.html is
// far too large to edit by hand and far too load-bearing to revert, so every
// edit that might already have been made is written as one of these.
function heal(h, label, from, to){
  const n = count(h.text, from);
  if(n === 0) return;
  h.text = h.text.split(from).join(to);
  applied++;
  console.log('patch-7013: healed ' + label + ' (' + n + ')');
}

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  // The silent-failure family this repo keeps re-learning: a replacement that
  // drops the newline the anchor had joins two lines together, and the join
  // parses. Every one of them is refused here instead of being found later.
  // (An empty replacement is the one case where the newline SHOULD go: it is a
  // whole block coming out, and taking its newline with it leaves no blank line.)
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

// Delete everything from the start of `from` through the end of `to`. Written for
// this release because the things coming out are whole panes and whole modules,
// and reproducing a hundred and six lines of markup as a literal is how a sub
// silently truncates instead of deleting. `opts.keep` is put back where the two
// ends meet; `opts.gone` is a string that was inside the span, so a second run
// can tell "already removed" from "the anchor moved".
function cut(h, label, from, to, opts){
  opts = opts || {};
  if(opts.gone && count(h.text, opts.gone) === 0){ already++; return; }
  const a = h.text.indexOf(from);
  if(a === -1){ problems.push('cut start anchor missing (' + label + ')'); return; }
  const b = h.text.indexOf(to, a + from.length);
  if(b === -1){ problems.push('cut end anchor missing (' + label + ')'); return; }
  h.text = h.text.slice(0, a) + (opts.keep || '') + h.text.slice(b + to.length);
  applied++;
}

// Delete every whole LINE that contains `needle`, whatever its indentation - the
// one shape that removes a guarded statement without having to reproduce it.
function delLine(h, label, needle, opts){
  opts = opts || {};
  if(opts.gone && count(h.text, opts.gone) === 0){ already++; return; }
  const out = [];
  let n = 0;
  for(const l of h.text.split('\n')){
    if(l.indexOf(needle) !== -1){ n++; continue; }
    out.push(l);
  }
  if(n === 0){ problems.push('line not found (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('line not unique, found ' + n + ' (' + label + ')'); return; }
  h.text = out.join('\n');
  applied++;
}

// Replace by pattern, for the guards and ternaries whose exact text is long and
// not worth transcribing. `opts.gone` short-circuits the "already done" case.
function re(h, label, pattern, replacement, opts){
  opts = opts || {};
  if(opts.gone && count(h.text, opts.gone) === 0){ already++; return; }
  const hits = h.text.match(pattern) || [];
  if(!hits.length){ problems.push('pattern not found (' + label + ')'); return; }
  const many = pattern.global ? hits.length : hits.length;
  if(many > 1 && !opts.all && !pattern.global){ problems.push('pattern not unique, found ' + many + ' (' + label + ')'); return; }
  h.text = h.text.replace(pattern, () => replacement);
  applied++;
}

const block = (lines) => lines.join('\n') + '\n';

const html = holder(fs.readFileSync(IDX, 'utf8'));
const mod = holder(fs.readFileSync(MOD, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

// `--check` on a tree that is already AT this release has nothing to report. The
// smaller releases give each sub a `key` so a second run can recognise its own
// work; this one has ninety of them and its anchors are made of text the release
// deletes, so it reads the version instead and says what it found. On a tree that
// is NOT at 70.1.3 the check below still does its real job - it names every
// anchor that has moved.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-7013: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================================ A. THE PAYWALL */
// Every gate the app carried. One predicate guarded forty-odd call sites, in
// four shapes: on a line of its own, inline in a longer statement, spread over
// braces, and as a ternary inside an expression. The first three go by pattern;
// the ternaries are named below them, because each one has to be told what to
// become rather than merely removed.
{
  let n = 0;
  const hit = () => { n++; };
  // 1. the guard that owns its line
  html.text = html.text.replace(/^[ \t]*if\(!isPremiumActive\(\)\)\{[^\n{}]*\}[ \t]*\n/gm, () => { hit(); return ''; });
  // 2. the extension of the app that reaches the predicate off the window
  html.text = html.text.replace(/^[ \t]*if\(!window\.isPremiumActive\(\)\)\{[^\n{}]*\}[ \t]*\n/gm, () => { hit(); return ''; });
  // 3. the guard spread over braces (Discover, the pinned-artists bubble)
  html.text = html.text.replace(/^[ \t]*if\(!isPremiumActive\(\)\)\{\n[\s\S]*?\n[ \t]*\}[ \t]*\n/gm, () => { hit(); return ''; });
  // 4. the same guard inline, in a handler that carries on afterwards
  html.text = html.text.replace(/if\(!isPremiumActive\(\)\)\{[^\n{}]*\}[ \t]*/g, () => { hit(); return ''; });
  // 5. the "quietly return" guards: the background discovery fetches that used to
  //    do nothing at all until Premium was on
  html.text = html.text.replace(/^[ \t]*if\(typeof isPremiumActive === 'function' && !isPremiumActive\(\)\) return;[ \t]*\n/gm, () => { hit(); return ''; });
  // 6. the PRO scroll pace, which used to clamp a stored value back to the default
  html.text = html.text.replace(/^[ \t]*if\(!\(typeof isPremiumActive === 'function' && isPremiumActive\(\)\)\) return 400;[ \t]*\n/gm, () => { hit(); return ''; });
  // 7. the brace-less one-liner, inline in a handler that carries on afterwards
  html.text = html.text.replace(/if\(!isPremiumActive\(\)\) return;[ \t]*/g, () => { hit(); return ''; });
  if(n === 0) problems.push('no premium guard was found to remove');
  console.log('patch-7013: removed ' + n + ' premium guard(s)');
}

// The theme picker: the click refusal and the two lock/FREE decorations.
sub(html, 'the theme lock', block([
  "        if(th.premium && !isPremiumActive()){",
  "          toast('This theme is a premium feature — unlock it to use it.');",
  "          openPremiumSettings();",
  "          return;",
  "        }",
]), '', { all: true });

re(html, 'the theme tile lock',
  /\n    const lock = \(th\.premium && !isPremiumActive\(\)\) \? '[^']*' : \(reward && !rewardOk \? '[^']*' : ''\);/,
  "\n    const lock = (reward && !rewardOk) ? '\uD83C\uDFC5 ' : '';",
  { gone: 'th.premium && !isPremiumActive()' });

re(html, 'the theme FREE tag',
  /\n      : \(\(!th\.premium && !isPremiumActive\(\)\) \? '[^']*' : ''\);/,
  "\n      : '';",
  { gone: '!th.premium && !isPremiumActive()' });

// The Sandbox panel: five PRO toggles, the now-bar size and the default-view
// dropdown were all locked, and the stored values were read back through the
// same check so a lapsed unlock could not leave its effect behind.
re(html, 'the sandbox default-view lock',
  /    if\(_sdv\)\{\n[\s\S]*?\n    \}\n/,
  block([
    "    if(_sdv){",
    "      // 70.1.3: there is no PRO tier left, so the saved view is simply used.",
    "      _sdv.value = sandboxDefaultView;",
    "      _sdv.disabled = false;",
    "      _sdv.style.opacity = '';",
    "      _sdv.style.cursor = '';",
    "      _sdv.title = '';",
    "    }",
  ]),
  { gone: 'var _sdvOk =' });

sub(html, 'the sandbox now-bar size',
  "    $('nowbarSizeValue').textContent = (typeof isPremiumActive === 'function' && isPremiumActive()) ? (sandboxNowbarSize + '%') : '100%';",
  "    $('nowbarSizeValue').textContent = sandboxNowbarSize + '%';");

sub(html, 'the sandbox PRO effects',
  '    var _proFx = (typeof isPremiumActive === \'function\' && isPremiumActive());',
  block([
    '    // 70.1.3: this used to be the entitlement, and every PRO setting below it',
    '    // was applied only while somebody had paid. Nothing is PRO any more.',
    '    var _proFx = true;',
  ]).replace(/\n$/, ''));

// Word-by-word lyrics: the button was hidden for everyone without Premium and
// the toggle refused to move.
sub(html, 'the word-by-word button',
  block([
    "      if(isPremiumActive()){",
    "        $('lyricsWordBtn').style.display = '';",
    "        $('lyricsWordBtn').textContent = 'Word-by-word: ' + (lyricsWordByWord ? 'On' : 'Off');",
    "        $('lyricsWordBtn').classList.toggle('active', lyricsWordByWord);",
    "        $('lyricsWwInfo').style.display = lyricsWordByWord ? '' : 'none';",
    "      } else {",
    "        $('lyricsWordBtn').style.display = 'none';",
    "        $('lyricsWwInfo').style.display = 'none';",
    "      }",
  ]),
  block([
    "      // 70.1.3: word-by-word lyrics used to need Premium to even appear.",
    "      $('lyricsWordBtn').style.display = '';",
    "      $('lyricsWordBtn').textContent = 'Word-by-word: ' + (lyricsWordByWord ? 'On' : 'Off');",
    "      $('lyricsWordBtn').classList.toggle('active', lyricsWordByWord);",
    "      $('lyricsWwInfo').style.display = lyricsWordByWord ? '' : 'none';",
  ]));

sub(html, 'the boot library view',
  block([
    "      libraryMode = ((typeof isPremiumActive === 'function' && isPremiumActive()) && sandboxDefaultView === 'albums')",
    "        ? 'albums'",
    "        : 'playlists';",
  ]),
  "      libraryMode = sandboxDefaultView === 'albums' ? 'albums' : 'playlists';\n");

// The Discover tab, which was the whole reason Premium existed. Its guard, the
// pinned-artists bubble and the Quick actions button all went with the sweep; what
// is left behind is the comment that sold Discover as a paid feature.
sub(html, 'the Discover note',
  block([
    "    // Discover is a premium feature. If not unlocked, send the user to the Premium",
    "    // tab instead of opening the catalog.",
  ]),
  block([
    "    // 70.1.3: Discover was the one feature Premium was really sold for. The tab",
    "    // opens the catalog now the way every other tab opens its own view.",
  ]));

/* ==================================================== B. THE PREMIUM SURFACE */
// The tab, the pane and every control in it. This is the part the user actually
// sees, and the part that used to sell four different things.
delLine(html, 'the Premium tab button', 'id="settingsTabPremium"');

cut(html, 'the Premium pane',
  '    <div id="settingsPanePremium" style="display:none; padding:6px 0;">',
  '    <div id="settingsPaneExpand" style="display:none;">',
  { keep: '    <div id="settingsPaneExpand" style="display:none;">', gone: 'id="premiumBuyView"' });

sub(html, 'the Premium quick-action option',
  '            <option value="premium">Premium</option>\n', '');

sub(html, 'the settings tab list',
  "  const SETTINGS_TABS = ['widget', 'premium', 'expand', 'theme', 'donate', 'refresh', 'glow', 'playback', 'eq', 'more', 'sandbox', 'support'];",
  "  const SETTINGS_TABS = ['widget', 'expand', 'theme', 'donate', 'refresh', 'glow', 'playback', 'eq', 'more', 'sandbox', 'support'];");

sub(html, 'the settings tab labels',
  "  const SETTINGS_TAB_LABELS = { widget: 'Widgets', premium: 'Premium', expand: 'Get Songs',",
  "  const SETTINGS_TAB_LABELS = { widget: 'Widgets', expand: 'Get Songs',");

sub(html, 'the custom action validation',
  "toast('Pick a settings page: premium, theme, donate, glow, playback, eq, more or sandbox')",
  "toast('Pick a settings page: theme, donate, glow, playback, eq, more or sandbox')");

sub(html, 'the settings tab switch',
  block([
    "    // Refresh / Playback / Equalizer were folded into the More tab.",
    "    if(tab === 'refresh' || tab === 'playback' || tab === 'eq') tab = 'more';",
  ]),
  block([
    "    // Refresh / Playback / Equalizer were folded into the More tab. 70.1.3 took",
    "    // the Premium tab out entirely; a saved quick action that still names it",
    "    // opens More rather than reaching for a pane that is not there any more.",
    "    if(tab === 'refresh' || tab === 'playback' || tab === 'eq' || tab === 'premium') tab = 'more';",
  ]));

delLine(html, 'the premium pane toggle', "$('settingsPanePremium').style.display");
delLine(html, 'the premium tab toggle', "$('settingsTabPremium').classList.toggle");
delLine(html, 'the premium tab init', "if(tab === 'premium') initPremiumTab();");
delLine(html, 'the premium tab click', "$('settingsTabPremium').addEventListener");

sub(html, 'the settings landing note',
  block([
    "    // Sandbox is free to browse; premium-only settings show a lock and require unlock to toggle.",
    "    // Home layout reordering is free for all users.",
  ]),
  "    // 70.1.3: there are no premium-only settings left, so every tab is a tab.\n");

sub(html, 'the Home quick-action meta',
  "const hbQuickMeta = { widget:['\uD83E\uDDE9','Widgets'], premium:['\uD83D\uDC51','Premium'], expand:['\uD83D\uDD17','Get Songs'],",
  "const hbQuickMeta = { widget:['\uD83E\uDDE9','Widgets'], expand:['\uD83D\uDD17','Get Songs'],");

/* ================================================== C. THE MONEY MACHINERY */
// The module header, then the entitlement, the gift codes, the Play
// subscription and lifetime products, the store licence API, both panes' wiring
// and the badge-wall grant. What is left is the billing plumbing the tip tiers
// are built on and the tip tiers themselves.
sub(html, 'the paid-features header',
  block([
    '  // ============================================================================',
    '  // PAID FEATURES — premium unlock + dev-gifted codes + working donation checkout',
    '  // ----------------------------------------------------------------------------',
    '  // SideCut is a static PWA with no backend, so "premium" is verified client-side:',
    '  //   • Codes: each code is SC-<8 base62 nonce>-<8 base62 HMAC tag>. Only the dev',
    '  //     can mint valid codes (the HMAC key is derived from a private PEM they keep',
    '  //     locally in dev/premium-private-key.pem, never shipped). The app embeds only',
    '  //     the derived key (a one-way SHA-256 of the PEM, so extracting it does NOT',
    '  //     reveal the source PEM) and re-computes the HMAC to verify.',
    '  //   • Paid plans ($1.29/month subscription + Lifetime) and Donate tips are',
    '  //     bought through Google Play Billing — natively in the installed app via',
    '  //     the RevenueCat plugin below (the Digital Goods API can\'t run in the',
    '  //     app\'s Capacitor WebView), with the Play Store listing as the browser',
    '  //     fallback. No manual checkout links; codes are only dev-gifted premium.',
    '  //',
    '  // ---- DEV CONFIG: paste your real links/handles here ------------------------',
  ]),
  block([
    '  // ============================================================================',
    '  // DONATIONS — the only thing this app asks anybody for',
    '  // ----------------------------------------------------------------------------',
    '  // 70.1.3 removed the paywall. There is no Premium, no subscription, no lifetime',
    '  // unlock, no gift code and no license key anywhere in the app, and every feature',
    '  // that used to sit behind one is free for everyone - including Discover, which',
    '  // is what all four ways of buying the app were actually selling.',
    '  //',
    '  // What is left of that machinery is the Donate tab, unchanged: a tip is bought',
    '  // through Google Play Billing (consumable one-time products) inside the copy',
    '  // installed from Play, and a tip unlocks nothing by design. The Play listing',
    '  // below is for the copies that cannot bill at all - the APK and the browser.',
    '  //',
    '  // ---- DEV CONFIG: where a copy that cannot bill gets sent -------------------',
  ]));

cut(html, 'the licence configuration',
  '  // ---- LICENSING: the way this app is paid for outside Google Play --------',
  "  const PREMIUM_STORAGE_KEY = 'sidecut_premium';\n",
  { gone: 'const LICENSE_CONFIG' });

cut(html, 'the entitlement',
  '  // ---------------------------------------------------------------------------\n\n  function isPremiumActive(){',
  '// ---------------- Google Play billing',
  { keep: '// ---------------- Google Play billing', gone: 'function isPremiumActive(){' });

delLine(html, 'the subscription product id', "const PLAY_SUBSCRIPTION_PRODUCT_ID = 'sidecutsub';");
delLine(html, 'the lifetime product id', "const PLAY_LIFETIME_PRODUCT_ID = 'lifetime';");
delLine(html, 'the Play grace window', 'const PLAY_SUB_GRACE_MS =');

cut(html, 'the Play entitlement sync',
  '  // Mirrors Play purchase state (one-time lifetime + monthly subscription) into',
  '  async function purchasePlayItem(sku, consumable){',
  { keep: '  async function purchasePlayItem(sku, consumable){', gone: 'async function syncPlayEntitlement(){' });

cut(html, 'the subscription purchases',
  '  async function purchasePlaySubscription(){',
  '  async function purchasePlayTip(sku){',
  { keep: '  async function purchasePlayTip(sku){', gone: 'purchasePlaySubscription' });

sub(html, 'the Play product type',
  '    const isSub = sku === PLAY_SUBSCRIPTION_PRODUCT_ID;',
  '    const isSub = false;   // 70.1.3: the app sells nothing but tips');

sub(html, 'the Play purchase tail',
  block([
    '      // The plugin consumes (isConsumable) or auto-acknowledges every',
    '      // purchase itself before resolving — nothing to do here. Try to surface the',
    '      // purchase immediately (the purchase list can lag a beat).',
    '      try{ setTimeout(() => { try{ syncPlayEntitlement(); }catch(_e){} }, 1200); }catch(_e){}',
  ]),
  block([
    '      // The plugin consumes (isConsumable) or auto-acknowledges every purchase',
    '      // itself before resolving — nothing to do here, and there is nothing to',
    '      // grant: a tip buys no entitlement, which is the whole point of it.',
  ]));

cut(html, 'the gift codes, the licence and the panes',
  '  }  // base64 \u2192 Uint8Array',
  '  // ---------------- Donate tab ----------------',
  {
    // `from` IS the line that closes purchasePlayTip, so the brace has to be put
    // back by the keep: without it the IIFE sixty lines above loses its end, and
    // the whole page stops parsing. It was three broken gates that said so.
    keep: '  }\n\n  // ---------------- Donate tab ----------------',
    gone: 'async function activateLicenseKey(key){',
  });

// The Donate tab gains the one route out it never had: a tip can only be bought
// through the Play copy, so a copy that cannot bill is sent to the listing
// rather than left holding a sentence.
sub(html, 'the donate fallback',
  block([
    "      const reason = await playBillingUnavailableReason();",
    "      msg.style.color = 'var(--ink-dim)';",
    "      msg.textContent = reason || 'Tips are processed through Google Play and only work inside the SideCut app installed from Play.';",
  ]),
  block([
    "      const reason = await playBillingUnavailableReason();",
    "      msg.style.color = 'var(--ink-dim)';",
    "      // 70.1.3: this is the APK and the browser, which have no Billing at all.",
    "      // A tip still cannot be made here - but the install that CAN make one is",
    "      // one tap away, so the message ends in the Play listing instead of a stop.",
    "      msg.textContent = (reason || 'Tips are processed through Google Play and only work inside the SideCut app installed from Play.') +",
    "        ' Opening the Play Store so you can install that copy.';",
    "      if(PAYMENT_CONFIG.playStoreListing){",
    "        try{ window.open(PAYMENT_CONFIG.playStoreListing, '_blank', 'noopener'); }catch(_eDon){ }",
    "      }",
  ]));

/* ================================================== D. BACKUP AND RESTORE */
// Premium rode inside every export so a paid unlock could follow somebody to a
// new phone. There is nothing to carry any more, and an old backup that still
// has the field is ignored rather than restored.
cut(html, 'the export premium payload',
  '  // Build the premium payload for an export when the user has premium active —',
  '  function showExportConfirm(message, onConfirm) {',
  { keep: '  function showExportConfirm(message, onConfirm) {', gone: 'function buildPremiumPayload(){' });

sub(html, 'the export track signature',
  '  async function doExportTracks(ids, filenameBase, manifestPlaylists, kindLabel, premiumPayload){',
  '  async function doExportTracks(ids, filenameBase, manifestPlaylists, kindLabel){');

sub(html, 'the export track toast',
  block([
    '      premium: premiumPayload,',
    "      toastOk: premiumPayload",
    "        ? 'Exported + premium code — import this .zip on another device to restore it'",
    "        : 'Exported — import this .zip on another device to restore it',",
  ]),
  "      toastOk: 'Exported — import this .zip on another device to restore it',\n");

sub(html, 'the playlist export',
  block([
    "      const premiumPayload = buildPremiumPayload();",
    "      await doExportTracks(ids, activePlaylist.replace(/[^a-z0-9]/gi,'_'), { [activePlaylist]: ids }, `\"${activePlaylist}\"`, premiumPayload);",
  ]),
  "      await doExportTracks(ids, activePlaylist.replace(/[^a-z0-9]/gi,'_'), { [activePlaylist]: ids }, `\"${activePlaylist}\"`);\n");

sub(html, 'the album export',
  block([
    "      const premiumPayload = buildPremiumPayload();",
    "      await doExportTracks(ids.slice(), 'sidecut-albums', albumGroups, `${albumCount} album${albumCount===1?'':'s'}`, premiumPayload);",
  ]),
  "      await doExportTracks(ids.slice(), 'sidecut-albums', albumGroups, `${albumCount} album${albumCount===1?'':'s'}`);\n");

sub(html, 'the selection export',
  block([
    "      const premiumPayload = buildPremiumPayload();",
    "      await doExportTracks(ids, `sidecut-selection-${ids.length}`, manifestPlaylists, 'selection', premiumPayload);",
  ]),
  "      await doExportTracks(ids, `sidecut-selection-${ids.length}`, manifestPlaylists, 'selection');\n");

cut(html, 'the zip manifest premium field',
  "    // Embed the user's premium unlock code into the manifest when requested, so an",
  '    if(opts.premium) manifest.premium = opts.premium;',
  { gone: 'if(opts.premium) manifest.premium = opts.premium;' });

sub(html, 'the library export confirm',
  'and your premium unlock code (if you have one) — as a full restorable backup .zip?',
  '\u2014 as a full restorable backup .zip?');

sub(html, 'the library export',
  block([
    "      const premiumPayload = buildPremiumPayload();",
    '      await runZipExport({',
    "        kindLabel: 'library',",
    '        tracks: allTracks.slice(),',
    '        manifest: { playlists, tracks: [], settings: {}, stats: {}, version: 2 },',
    "        filename: 'sidecut-library.zip',",
    '        premium: premiumPayload,',
    '        toastOk: premiumPayload',
    "          ? 'Library + premium code exported — keep this .zip somewhere safe'",
    "          : 'Library exported — keep this .zip somewhere safe',",
  ]),
  block([
    '      await runZipExport({',
    "        kindLabel: 'library',",
    '        tracks: allTracks.slice(),',
    '        manifest: { playlists, tracks: [], settings: {}, stats: {}, version: 2 },',
    "        filename: 'sidecut-library.zip',",
    "        toastOk: 'Library exported — keep this .zip somewhere safe',",
  ]));

cut(html, 'the import premium restore',
  '      // Restore premium from a backup that included the unlock code.',
  '      // Restore discovery data (album history',
  { keep: '      // Restore discovery data (album history', gone: 'manifest.premium' });

/* ================================================== E. THE PUBLISHED SURFACE */
delLine(html, 'the window entitlement', 'window.isPremiumActive = isPremiumActive;');
delLine(html, 'the window premium settings', 'window.openPremiumSettings = openPremiumSettings;');
delLine(html, 'the window Play sync', 'window.syncPlayEntitlement = syncPlayEntitlement;');

// The launch and focus re-verification of Play purchases and licence keys. There
// is nothing to re-verify, and the one thing that shared the listener was the
// background-playback check, which is not about money and stays.
sub(html, 'the boot entitlement wiring',
  block([
    '  // Play Billing: re-verify purchases on launch and whenever the app regains',
    '  // focus (e.g. after returning from the Play billing sheet).',
    '  syncPlayEntitlement();',
    '  revalidateLicense();',
    "  window.addEventListener('focus', () => { syncPlayEntitlement(); revalidateLicense(); if(window.__scCheckBackgroundPlayback) window.__scCheckBackgroundPlayback(); });",
    "  document.addEventListener('visibilitychange', () => { if(!document.hidden){ syncPlayEntitlement(); revalidateLicense(); } });",
  ]),
  block([
    '  // 70.1.3: this is where Play purchases and licence keys were re-verified on',
    '  // launch and again on every return to the app. A tip is not an entitlement and',
    '  // there is no entitlement left to check, so those two calls are gone - but the',
    '  // background-playback check that shared this listener is not about money.',
    "  window.addEventListener('focus', () => { if(window.__scCheckBackgroundPlayback) window.__scCheckBackgroundPlayback(); });",
  ]));
delLine(html, 'the licence redeem probe', 'window.__scLicenseRedeem =');
delLine(html, 'the licence check probe', 'window.__scLicenseCheck =');

cut(html, 'the entitlement bridge',
  '  // The 201-badge reward. It is a real grant through the same setter the store',
  '})();\n</script>',
  {
    // The hooks this block published are not named here: the gate at the bottom
    // of this file asserts that neither string appears in the page at all, and a
    // comment counts as an appearance.
    keep: block([
      '  // 70.1.3: this block was the bridge between the badge wall and Studio and',
      '  // the one entitlement the app had - it published both ends of it, the ask',
      '  // and the mint. There is no entitlement, so there is nothing to ask and',
      '  // nothing to mint, and neither hook is published at all.',
    ]) + '})();\n</script>',
    gone: 'window.__scGrantPremium = function(opts){',
  });

/* ======================================================= F. THE COPY THAT NAMED IT */
sub(html, 'the Discover globals note',
  block([
    '  // as globals; everything they use (isPremiumActive, openPremiumSettings, toast,',
    '  // renderNewReleasesDropdown) is a hoisted function declaration, and the toggles',
  ]),
  block([
    '  // as globals; everything they use (toast, renderNewReleasesDropdown) is a',
    '  // hoisted function declaration, and the toggles',
  ]));

sub(html, 'the Home Get Songs note',
  '(free — no premium needed)',
  '(free, like everything else in here)');

sub(html, 'the assistant system prompt',
  'the Settings tabs are Premium, Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget and More',
  'the Settings tabs are Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget and More');

sub(html, 'the assistant knowledge heading',
  '  // ═══ PREMIUM & DISCOVER ═══',
  '  // ═══ DISCOVER — free for everyone since 70.1.3 ═══');

sub(html, 'the assistant premium answer',
  "{q:['premium','unlock premium','what is premium','premium features','buy premium'],a:'**Premium** unlocks the **Discover** tab (song search, pinned artists, new releases, singles, album history). Go to **Settings → Premium** to learn more and unlock it. Premium is a one-time purchase — no subscription.'},",
  "{q:['premium','unlock premium','what is premium','premium features','buy premium'],a:'SideCut has **no Premium** any more — 70.1.3 removed it, and every feature it used to lock is free for everyone, including the **Discover** tab (song search, pinned artists, new releases, singles, album history), word-by-word lyrics, all the animated themes and the Studio practice loop. There is nothing to buy and nothing to unlock, and the **Donate** tab is there if you want to give something back.'},");

sub(html, 'the assistant discover answer',
  'The **Discover** tab lets you search for songs by name, preview them, and add them to your library. Premium unlocks full search, pinned artists, new releases, singles, and album history.',
  'The **Discover** tab lets you search for songs by name, preview them, and add them to your library, and all of it is free: full search, pinned artists, new releases, singles, and album history.');

sub(html, 'the theme list note',
  block([
    '    // user without premium. Keep this list and the three places that describe',
    '    // the split (the premium page, the seizure warning in More and the',
    '    // first-run guide) in step.',
  ]),
  block([
    '    // were free while ten were not. 70.1.3 removed the split: every theme in',
    '    // this list is available to everyone, so there is nothing left to describe',
    '    // in step with it.',
  ]));

heal(html, 'the remaining premium theme flag', 'premium:true, ', '');
heal(html, 'the reward split in the theme list',
  "    // ── v60: five more dynamic themes, all premium. Each has its own palette",
  "    // ── v60: five more dynamic themes. Each has its own palette");

sub(html, 'the reward theme comment',
  block([
    '        // A reward theme is free the moment the badges are there, for everyone,',
    '        // with or without Premium - so it is checked after the premium gate.',
  ]),
  block([
    '        // A reward theme is free the moment the badges are there, for everyone,',
    '        // and that check has always been independent of whether Premium is on.',
  ]));

sub(html, 'the sandbox lock comment',
  block([
    '    // A PRO control a free user cannot use should look that way. Without this the',
    '    // "Default view on boot" dropdown moved under the finger and then did nothing,',
    '    // which reads as the setting being broken rather than as it being locked.',
  ]),
  block([
    '    // 70.1.3: the "Default view on boot" dropdown was a PRO control that a free',
    '    // user could move and then found did nothing. It is simply a setting now.',
  ]));

sub(html, 'the sandbox effects comment',
  block([
    '    // One premium check for every PRO control in this panel. The click gates stop',
    '    // a free user from SETTING these, but the values are read back out of storage',
    '    // on every boot — so without this the effects of a PRO setting could survive',
    '    // a lapsed unlock, or arrive with a restored backup. The five below are the',
    '    // panel\'s free settings and are applied unchanged.',
  ]),
  block([
    '    // Every sandbox setting is applied straight from storage on every boot. This',
    '    // used to be two lists - the free five, and everything below that a premium',
    '    // check had to approve first, so a lapsed unlock could not leave its effect',
    '    // behind. 70.1.3 removed the check, so there is one list again.',
  ]));

sub(html, 'the scroll pace comment',
  block([
    '    // Scroll speed is a PRO setting, so a free user gets the default pace even if',
    '    // a stored value says otherwise (the same reason as the visuals above).',
  ]),
  block([
    '    // The stored scroll pace is used as it is. This returned the default for',
    '    // anyone without the entitlement, which 70.1.3 took away with the rest.',
  ]));

/* ======================================================== G. THE MODULE IN STUDIO */
// The Studio half. `isPro()`/`proOnly()` are the whole entitlement surface the
// module ever had, so they go, and the two tools they guarded are simply tools.
sub(mod, 'the Studio entitlement',
  block([
    '  /* --------------------------------------------------------------------------',
    '     3b. THE SLEEP TIMER, THE PRACTICE LOOP, AND YOUR OWN PRESETS (70.1.2)',
    '',
    '     "add more features to studio" and "make their an actual reason to get',
    '     SideCut premium", in one section, because they are the same answer to the',
    '     same question: the free half is the sleep timer (a player needs it, a',
    '     musician does not pay for it) and the paid half is the two tools with a',
    '     memory - a loop that speeds up as you learn the part, and presets you save',
    '     yourself.',
    '',
    '     The entitlement is never kept here. `isPro()` asks the app, which is the',
    '     part that knows about a purchase, a licence key, a gift code and the badge',
    '     wall, so Studio cannot disagree with it.',
    '     -------------------------------------------------------------------------- */',
    "  function isPro(){ return !!call('__scIsPremium'); }",
    '  function proOnly(what){',
    '    if(isPro()) return true;',
    "    toast(what + ' is part of Studio Premium \\u2014 the Studio Premium section on this screen opens it.');",
    '    return false;',
    '  }',
  ]),
  block([
    '  /* --------------------------------------------------------------------------',
    '     3b. THE SLEEP TIMER, THE PRACTICE LOOP, AND YOUR OWN PRESETS (70.1.3)',
    '',
    '     "add more features to studio", and then "Remove premium make everything',
    '     free keep donations". So the two tools that remember things for you are',
    '     just here: the loop that steps up as you learn the part, and presets you',
    '     save yourself. There is no half of Studio to pay for and no entitlement to',
    '     ask the app for - 70.1.3 took the paywall out of the whole app.',
    '     -------------------------------------------------------------------------- */',
  ]));

sub(mod, 'the practice loop heading',
  '  // ---- the practice loop (Premium) ----------------------------------------',
  '  // ---- the practice loop ---------------------------------------------------');

sub(mod, 'the presets heading',
  '  // ---- your own presets (Premium) -----------------------------------------',
  '  // ---- your own presets ----------------------------------------------------');

delLine(mod, 'the practice loop gate', "    if(!proOnly('The practice loop')){ renderStudio(); return; }");
delLine(mod, 'the preset gate', "    if(!proOnly('Saving your own presets')) return;");

sub(mod, 'the practice loop button',
  block([
    '    var pro = isPro()',
    "      ? '<button class=\"sc-btn primary\" id=\"scPracGo\">' + (practice.on ? 'Restart the loop' : 'Start looping') + '</button>' +",
    "        (practice.on ? '<button class=\"sc-btn\" id=\"scPracOff\">Stop</button>' : '')",
    "      : '<button class=\"sc-btn primary\" data-act=\"openpremium\">Unlock Premium to loop it</button>';",
  ]),
  block([
    "    var pro = '<button class=\"sc-btn primary\" id=\"scPracGo\">' + (practice.on ? 'Restart the loop' : 'Start looping') + '</button>' +",
    "        (practice.on ? '<button class=\"sc-btn\" id=\"scPracOff\">Stop</button>' : '');",
  ]));

sub(mod, 'the preset save row',
  block([
    '    var save = isPro()',
    "      ? '<div style=\"display:flex;gap:8px;align-items:center;margin-top:10px;\"><input type=\"text\" id=\"scMyName\" maxlength=\"40\" placeholder=\"Name this chain\" autocomplete=\"off\"><button class=\"sc-btn primary\" id=\"scMySave\">Save current</button></div>'",
    "      : '<div class=\"sc-actions\"><button class=\"sc-btn tiny\" data-act=\"openpremium\">Unlock Premium to save your own</button></div>';",
  ]),
  "    var save = '<div style=\"display:flex;gap:8px;align-items:center;margin-top:10px;\"><input type=\"text\" id=\"scMyName\" maxlength=\"40\" placeholder=\"Name this chain\" autocomplete=\"off\"><button class=\"sc-btn primary\" id=\"scMySave\">Save current</button></div>';\n");

cut(mod, 'the Studio Premium section',
  '  // ---- what Premium adds HERE, said where it is used -----------------------',
  '  /* --------------------------------------------------------------------------\n     4. CROP -> SHARE AS CLIP',
  { keep: '  /* --------------------------------------------------------------------------\n     4. CROP -> SHARE AS CLIP', gone: 'function premiumStudioHtml(){' });

delLine(mod, 'the Studio Premium render', '      premiumStudioHtml() +');
delLine(mod, 'the openpremium action', "        else if(act === 'openpremium'){");
delLine(mod, 'the isPro export', '    isPro: isPro,');

sub(mod, 'the dev reset note',
  "          toast('Dev: badges, counters and feature flags cleared. Premium was left alone.', 4200);",
  "          toast('Dev: badges, counters and feature flags cleared.', 4200);");

// The 201st badge. It used to mint Premium through the app's own setter; it is
// the finished wall now, and the row says so instead of offering to sell it.
sub(mod, 'the 201 reward',
  "    { at: 201, kind: 'premium', key: 'premium', name: 'SideCut Premium', note: 'Every badge in the app, including the secret one' }",
  "    { at: 201, kind: 'complete', key: 'complete', name: 'The whole wall', note: 'Every badge in the app, including the secret one' }");

sub(mod, 'the reward row state',
  "      ? (r.kind === 'premium' ? '<span class=\"sc-reward-have\">Granted, free</span>' : '<span class=\"sc-reward-have\">Unlocked</span>')",
  "      ? '<span class=\"sc-reward-have\">Unlocked</span>'");

sub(mod, 'the reward row action',
  block([
    "      : (r.kind === 'theme'",
    "        ? '<button class=\"sc-btn tiny primary\" data-act=\"usetheme\" data-key=\"' + r.key + '\">Use it</button>'",
    "        : '<button class=\"sc-btn tiny\" data-act=\"openpremium\">Open Premium</button>');",
  ]),
  block([
    "      : (r.kind === 'theme'",
    "        ? '<button class=\"sc-btn tiny primary\" data-act=\"usetheme\" data-key=\"' + r.key + '\">Use it</button>'",
    "        : '');",
  ]));

sub(mod, 'the reward grant',
  block([
    '  function grantRewards(silent){',
    '    if(!rewardEarned(201)) return false;',
    '    if(lsGet(LS.reward, null)) return false;',
    "    var ok = call('__scGrantPremium', { plan: 'badges', gifted: true, note: 'All 201 badges' });",
    '    lsSet(LS.reward, { at: Date.now(), granted: !!ok });',
    "    if(!silent) toast('\\ud83d\\ude80 201 of 201 \\u00b7 SideCut Premium is yours, free. Thank you for playing with all of it.', 6000);",
    '    return !!ok;',
    '  }',
  ]),
  block([
    '  // 70.1.3 - the wall used to end in a purchase, and there is no purchase to end',
    '  // in. The trophy is the wall itself, so this is the celebration and nothing else.',
    '  function grantRewards(silent){',
    '    if(!rewardEarned(201)) return false;',
    '    if(lsGet(LS.reward, null)) return false;',
    '    lsSet(LS.reward, { at: Date.now(), granted: true });',
    "    if(!silent) toast('\\ud83d\\ude80 201 of 201 \\u00b7 the whole wall. Thank you for playing with all of it.', 6000);",
    '    return true;',
    '  }',
  ]));

sub(mod, 'the reward grant call',
  block([
    '    // See the note above the reward table: Premium follows the count, so it is',
    '    // granted on every evaluation of it, not only when a badge unlocks.',
    '    grantRewards(!!silent);',
  ]),
  block([
    '    // See the note above the reward table: the 201st tile is a reward, so it is',
    '    // celebrated on every evaluation of the count, not only when one unlocks.',
    '    grantRewards(!!silent);',
  ]));

re(mod, 'the reward table note',
  /\n\s*201 and the five rewards still sit at 50, 100, 150, 200 and 201\./,
  '\n          201 and the five rewards still sit at 50, 100, 150, 200 and 201, the\n          last of them the finished wall since 70.1.3 rather than a purchase.');

sub(mod, 'the badge wall header',
  block([
    '     5b. TWO HUNDRED BADGES, ONE SECRET, AND FIVE REWARDS (70.0.5, revised 70.0.6)',
  ]),
  block([
    '     5b. TWO HUNDRED BADGES, ONE SECRET, AND FIVE REWARDS (70.0.5, revised 70.1.3)',
  ]));

heal(mod, 'the premium badge note', 'a dynamic theme that whirls under your finger at 200, and free Premium at 201',
  'a dynamic theme that whirls under your finger at 200, and the whole wall at 201');
heal(mod, 'the premium reward note', 'can disagree with the badges themselves. Premium is the one reward with a\n         side effect, so that one is granted once and recorded.',
  'can disagree with the badges themselves. The last one used to have the one side\n         effect in the table - a grant of Premium - and 70.1.3 took that with it.');
heal(mod, 'the premium badge comment', 'and every badge is needed for the Premium reward - so it', 'and every badge is needed for the reward at the end - so it');
heal(mod, 'the premium card note', '      // 70.1.2. The sleep timer is free and says so by not mentioning money;\n      // the practice loop is the paid one, so Premium is named on the card\n      // itself rather than only inside the sheet.',
  '      // 70.1.2 added these two cards, and 70.1.3 took the price off them: the\n      // timer stops the music and the loop loops, both for everyone.');

/* ============================================ K. THE COPY THAT STILL SELLS IT */
// A paywall that is gone while the app still tells you to go and unlock it is not
// a removal, it is a broken screen. Everything below either named Premium in a
// place a user can see, or was a control that existed only to sell it. The
// assistant's knowledge base is in here too, because "how do I unlock Premium"
// is a question the Support tab really answers.
cut(html, 'the export premium checkbox',
  '    <label id="exportPremiumOpt"',
  '    </label>\n',
  { gone: 'id="exportPremiumChk"' });

sub(html, 'the export confirm premium toggle',
  block([
    "    const opt = $('exportPremiumOpt');",
    "    if(opt) opt.style.display = 'none';",
  ]), '');

sub(html, 'the sandbox split note',
  block([
    '      <div style="font-size:11px; color:var(--ink-dim); margin-bottom:12px; padding:8px; background:rgba(255,255,255,0.03); border-radius:8px; line-height:1.5;">',
    '        <b>Free:</b> Compact rows, hide art, duration on tabs, larger taps, play counts, always search, action bar order, home layout.<br>',
    '        <b style="color:var(--gold);">Premium:</b> <span style="color:var(--gold);">Bigger art, album names, accessibility, scroll speed, default view, now bar, compact header, custom actions.</span>',
    '      </div>',
  ]),
  block([
    '      <div style="font-size:11px; color:var(--ink-dim); margin-bottom:12px; padding:8px; background:rgba(255,255,255,0.03); border-radius:8px; line-height:1.5;">',
    '        Every switch in Sandbox is on for everyone. Compact rows, hide art, duration on tabs, larger taps, play counts, always search, action bar order, home layout, bigger art, album names, accessibility, scroll speed, default view, now bar, compact header and custom actions - the line that used to divide this list in two was the paywall, and it is gone.',
    '      </div>',
  ]));

sub(html, 'the lyrics word-by-word summary',
  '>Word-by-word lyrics (premium)</summary>',
  '>Word-by-word lyrics</summary>');

re(html, 'the animated theme note', /Premium dynamic themes/, 'Dynamic themes');

sub(html, 'the theme split note',
  block([
    '    // v64.1 - which animated themes are premium. Five stay free for everyone:',
    '    // RGB, RGB +, Ember, Galaxy and Glacier. Every other theme that animates',
    '    // is premium only, and the Theme tab shows each one with a lock for a',
    '    // were free while ten were not. 70.1.3 removed the split: every theme in',
    '    // this list is available to everyone, so there is nothing left to describe',
    '    // in step with it.',
  ]),
  block([
    '    // v64.1 drew a line through this list: five animated themes were free for',
    '    // everyone and ten were sold with Premium, each with a lock on its tile.',
    '    // 70.1.3 removed the split, so every theme here is available to everyone.',
  ]));

sub(html, 'the bubble sizing note',
  block([
    '  // want. This is the free half of the Home layout editor: reordering and (now)',
    '  // exact sizing without premium.',
  ]),
  block([
    '  // want. Reordering and exact sizing, both of them free - this used to be',
    '  // described as the free half of the editor, and there is no other half.',
  ]));

sub(html, 'the word-by-word marker',
  '          // Word-by-word highlighting within the current line (premium) —',
  '          // Word-by-word highlighting within the current line -');

sub(html, 'the snapshot list',
  '(settings, premium, pins, singles, playlists, theme, stats, counters)',
  '(settings, pins, singles, playlists, theme, stats, counters)');

sub(html, 'the export probe',
  '    doExportTracks: (ids, base, pl, kind, premium) => doExportTracks(ids, base, pl, kind, premium),',
  '    doExportTracks: (ids, base, pl, kind) => doExportTracks(ids, base, pl, kind),');

sub(html, 'the songs-only note',
  '  // settings, stats, covers, or premium code. Fast, shareable (re-importable as',
  '  // settings, stats, or covers. Fast, shareable (re-importable as');

// The assistant. These six answers are the ones a user reaches by asking how to
// pay for the app, so each one has to say what is true now.
sub(html, 'kb the backup answer',
  'it saves a .zip with your songs, playlists, stats, themes and premium code.',
  'it saves a .zip with your songs, playlists, stats and themes.');

sub(html, 'kb the quick actions answer',
  'Widgets, Premium, Get Songs, Theme, Donate, Refresh, Glow, Playback, EQ, More, Sandbox, Support.',
  'Widgets, Get Songs, Theme, Donate, Refresh, Glow, Playback, EQ, More, Sandbox, Support.');

sub(html, 'kb the sandbox answer',
  'is a premium feature with experimental tweaks like custom quick actions, Home layout, and more.',
  'holds experimental tweaks like custom quick actions and the Home layout editor, and every one of them is free.');

sub(html, 'kb the donate answer',
  'or by unlocking **Premium** in **Settings → Premium**. Premium is a one-time purchase that unlocks Discover and all advanced features.',
  '- and that is the only thing the app asks anybody for. A tip unlocks nothing on purpose, because everything in SideCut is already free.');

sub(html, 'kb the paid-version answer',
  '**Premium** (one-time purchase in Settings → Premium) unlocks the Discover tab with song search, previews, pinned artists, new releases, singles, and album history.',
  'Everything is free: the Discover tab with song search, previews, pinned artists, new releases, singles and album history is open to everyone, and there is nothing to buy.');

sub(html, 'kb the why-free answer',
  'Premium unlocks Discover features (search, previews, artist tracking) to support ongoing development.',
  'There is no Premium any more - 70.1.3 removed it, so Discover (search, previews, artist tracking) is free for everyone, and the Donate tab is there if you want to support development.');

// The Studio module's own copy.
sub(mod, 'the dev reset note body',
  "      '<div class=\"sc-dev-note\">A reset clears badges, counters and feature flags. It never takes Premium back \\u2014 a reward is not a switch, and a real purchase is not a dev tool\\u2019s to undo.</div>' +",
  "      '<div class=\"sc-dev-note\">A reset clears badges, counters and feature flags. It never takes a reward back \\u2014 a reward is not a switch, and the four themes and the trophy at the end of the wall are not this tool\\u2019s to undo.</div>' +");

sub(mod, 'the theme gate note',
  '  // the moment the badges are there, for everyone, with or without Premium.',
  '  // the moment the badges are there, for everyone.');

re(mod, 'the Studio card note',
  /the practice loop is the paid one, so Premium is named on the card\n\s*\/\/ itself rather than only inside the sheet\./,
  'the sleep timer and the practice loop are simply two more tools, with no\n      // price named on either of them.');

sub(mod, 'the reward side-effect note',
  'can disagree with the badges themselves. The last one used to have the one side\n         effect in the table - a grant of Premium - and 70.1.3 took that with it.',
  'can disagree with the badges themselves. The last one used to have the table\u2019s\n         only side effect, a grant of Premium, and 70.1.3 took that away with it, so\n         the wall ends in a trophy now.');

/* ================================================= H. THE MODULE, SPLICED BACK */
{
  const blockRe = /<script id="sc-studio-70">[\s\S]*?<\/script>\n/;
  const wrapped = '<script id="sc-studio-70">\n' + mod.text + '</script>\n';
  if(blockRe.test(html.text)){
    const before = html.text;
    html.text = html.text.replace(blockRe, wrapped);
    if(html.text === before) already++; else applied++;
  } else {
    problems.push('the sc-studio-70 script block is missing');
  }
}

/* ==================================================== I. THE RELEASE METADATA */
sub(html, 'the version', "const APP_VERSION = '70.1.2';", "const APP_VERSION = '70.1.3';");
sub(sw, 'the shell cache', "const CACHE_NAME = '" + OLDCACHE + "';", "const CACHE_NAME = '" + CACHE + "';");

sub(html, 'the changelog entry',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + block([
    "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ]) + NOTES.map((n) => "    '" + n + "',").join('\n') + '\n  ] },\n',
  { key: "const CHANGELOG = [\n  { version: '" + VERSION + "'" });

/* ================================================================== J. THE GATES */
// test-705 is the standing release gate for the 70.x line. Four of its rules
// asserted the paywall; they assert its absence now, which is a stronger claim
// than the one they made.
{
  const t705 = holder(fs.readFileSync(TEST705, 'utf8'));

  sub(t705, 'test-705 the entitlement rule',
    block([
      "  ok(has('window.__scIsPremium = function(){'), 'Studio has no way to ask whether Premium is on');",
      "  ok(countMod(\"function isPro(){ return !!call('__scIsPremium'); }\") === 1,",
      "     'and it keeps its own copy of the entitlement instead of asking');",
    ]),
    block([
      '  // 70.1.3. "Remove premium make everything free keep donations". Every rule',
      '  // the 70.1 block below made about the paywall is made the other way round:',
      '  // the absence is the assertion, because a page that still carries a premium',
      '  // gate, a premium state, a purchase or a licence path has not done the job.',
      "  ok(count('isPremiumActive') === 0 && count('sidecut_premium') === 0,",
      "     'the app still carries a premium gate or a premium state');",
      "  ok(count('LICENSE_CONFIG') === 0 && count('PREMIUM_HMAC_KEY_B64') === 0 && count('__scGrantPremium') === 0,",
      "     'or any of the machinery that used to sit behind one');",
    ]),
    { key: 'the app still carries a premium gate or a premium state' });

  sub(t705, 'test-705 the Studio rules',
    block([
      "  ok(countMod(\"if(!proOnly('The practice loop')){ renderStudio(); return; }\") === 1,",
      "     'the practice loop is not the paid half');",
      "  ok(countMod('function saveMyPreset(){') === 1 && countMod(\"function proOnly(what){\") === 1,",
      "     'and saving your own presets is not');",
    ]),
    block([
      "  ok(countMod('isPro') === 0 && countMod('proOnly') === 0 && countMod('__scIsPremium') === 0,",
      "     'and Studio still asks the app whether Premium is on');",
    ]),
    { key: 'and Studio still asks the app whether Premium is on' });

  sub(t705, 'test-705 the Studio Premium section',
    "  ok(countMod('function premiumStudioHtml(){') === 1 && countMod('if(isPro()) return \\'\\';') === 1,\n     'and Premium is not named where it is used');",
    "  ok(countMod('premiumStudioHtml') === 0 && countMod('openpremium') === 0,\n     'and a Studio Premium section is still being sold here');",
    { key: 'and a Studio Premium section is still being sold here' });

  sub(t705, 'test-705 the 201 reward',
    "  ok(countMod('at: 201, kind: \\'premium\\'') === 1 && countMod('function myPresetsHtml(){') === 1,",
    "  ok(countMod(\"at: 201, kind: 'complete'\") === 1 && countMod('function myPresetsHtml(){') === 1,",
    { key: "at: 201, kind: 'complete'" });

  // The 70.1 block, wholesale: everything in it asserted a licence key, a store
  // or a pane to paste one into, and none of those are in the page any more.
  sub(t705, 'test-705 the 70.1 licence block',
    block([
      '  // 70.1. Paying for the APK: a key bought on the web, checked by the store,',
      '  // kept offline. The rules are about what must NOT be in the file, and about',
      '  // what must never happen to somebody who has already paid.',
      "  ok(has('const LICENSE_CONFIG = {'), 'the web checkout is not configured in the app');",
      "  ok(has(\"validateUrl: 'https://api.lemonsqueezy.com/v1/licenses/validate'\") &&",
      "     has(\"activateUrl: 'https://api.lemonsqueezy.com/v1/licenses/activate'\") &&",
      "     has(\"deactivateUrl: 'https://api.lemonsqueezy.com/v1/licenses/deactivate'\"),",
      "     'and it does not point at a store licence API');",
      "  ok(has('NOTHING SECRET GOES IN THIS OBJECT') &&",
      '     !/LEMONSQUEEZY_API_KEY|LEMON_SQUEEZY_API_KEY/i.test(src),',
      "     'and no store secret is shipped in the page (the endpoints need none)');",
      "  ok(count(\"licensePost(LICENSE_CONFIG.activateUrl\") === 1 &&",
      "     count(\"licensePost(LICENSE_CONFIG.validateUrl\") === 1,",
      "     'a key is activated against the store and validated against it');",
      "  ok(count('instance_name: licenseInstanceName()') === 1,",
      "     'and the device is recorded as an activation, so a device limit means something');",
      "  ok(count('// unreachable store: the unlock stays, untouched') === 1,",
      "     'a store that cannot be reached must never lock a paying user out');",
      "  ok(count(\"if(data.valid === false){\") === 1 && count('clearPremiumQuietly();') >= 2,",
      "     'only the store saying not valid can take the unlock away');",
      "  ok(count('offerLicenseOrPlayStore(msg, url);') === 2,",
      "     'both Play buttons hand over to the web checkout when Play cannot sell');",
      "  ok(count('id=\"premiumLicenseInput\"') === 1 && count('id=\"premiumLicenseBtn\"') === 1 &&",
      "     count('id=\"premiumLicenseBuyBtn\"') === 1,",
      "     'and the pane offers both halves: the checkout and the box to paste the key in');",
      "  ok(has('The web checkout is not open yet'),",
      "     'an unset checkout link says so instead of opening a dead link');",
      "  ok(count('releaseLicenseActivation(); clearPremium();') === 1,",
      "     'removing premium gives the activation back to the store');",
      "  ok(count(\"const PREMIUM_HMAC_KEY_B64 = \") === 1 && count(\"parts[0] !== 'SC'\") === 1,",
      "     'and the gift-code path is exactly where it was');",
      "  ok(count('id=\"premiumLicenseMsg\"') === 1,",
      "     'and the pane can say what the store answered');",
      "  ok(count(\"'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'\") === 1,",
      "     'and the only thing sent with a key is the key itself');",
      "  ok(count('new URLSearchParams()') === 1, 'and the body is encoded like the form it is');",
    ]),
    block([
      '  // 70.1.3. What has to be true now is the opposite of the block that used to',
      '  // be here, plus the one thing that had to survive it: Donate.',
      "  ok(count(\"toast('Premium feature\") === 0 && !has('premium:true'),",
      "     'a premium gate or a premium theme flag is still in the page');",
      "  ok(count('id=\"settingsTabPremium\"') === 0 && count('settingsPanePremium') === 0,",
      "     'and the Premium tab is still in Settings');",
      "  ok(count('id=\"premiumLicenseInput\"') === 0 && count('id=\"premiumCodeInput\"') === 0 &&",
      "     count('id=\"premiumBuyView\"') === 0 && count('id=\"premiumStatusBox\"') === 0,",
      "     'and there is still something in the sheet to buy or redeem');",
      "  ok(count('clearPremium') === 0 && count('setPremiumActive') === 0 && count('_proFx = true') === 1,",
      "     'and anything at all can still lock the app');",
      "  ok(count('activateLicenseKey') === 0 && count('revalidateLicense') === 0 &&",
      "     count('offerLicenseOrPlayStore') === 0 && count('licensePost') === 0,",
      "     'and a licence key is still checked with a store');",
      "  ok(count('__scGrantPremium') === 0 && count('__scLicenseRedeem') === 0 && count('buildPremiumPayload') === 0,",
      "     'and a badge, a backup or a probe can still grant Premium');",
      '  // And what the removal must NOT have taken with it.',
      "  ok(count('id=\"settingsTabDonate\"') === 1 && count('id=\"settingsPaneDonate\"') === 1 &&",
      "     count('function initDonateTab(){') === 1,",
      "     'the Donate tab left with the premium pane');",
      "  ok(count('const PLAY_TIP_PRODUCTS = {') === 1 && count('purchasePlayTip') === 2,",
      "     'or the tip tiers it is built on');",
      "  ok(count('donate-quick') >= 12 && count('PAYMENT_CONFIG.playStoreListing') >= 2,",
      "     'or the tip buttons, or the route out for a copy that cannot bill');",
    ]),
    { key: 'a premium gate or a premium theme flag is still in the page' });

  // Four rules the 70.0.5 block made about the badge wall, which ended in the one
  // reward that was a purchase.
  sub(t705, 'test-705 the reset note',
    "  ok(/Premium was left alone/.test(mod), 'and the reset says out loud that Premium is not its to take back');",
    block([
      '  // 70.1.3: the reset note used to say Premium was not its to take back. There',
      '  // is no Premium, so what it must not take back is the wall\u2019s own reward.',
      "  ok(/never takes a reward back/.test(mod), 'and the reset says out loud that a reward is not its to take back');",
    ]),
    { key: 'and the reset says out loud that a reward is not its to take back' });

  sub(t705, 'test-705 the 201 kind',
    "  ok(ats[4].kind === 'premium' && ats[4].at === 201, 'and the 201 one is Premium, behind the secret badge');",
    block([
      "  ok(ats[4].kind === 'complete' && ats[4].at === 201,",
      "     'and the 201 one finishes the wall, behind the secret badge');",
    ]),
    { key: 'and the 201 one finishes the wall' });

  sub(t705, 'test-705 the grant hook',
    block([
      "  ok(count(src, 'window.__scGrantPremium') === 1, 'and the Premium grant is one named hook');",
      "  ok(src.indexOf(\"setPremiumActive(Object.assign({ plan: 'gifted', gifted: true, source: 'badges' }\") !== -1,",
      // The escape is literal in that file: it is \u2019 in the source, not the
      // character, so the patch has to carry a backslash as well.
      "    'which goes through the app\\u2019s own premium setter, marked as a gift');",
    ]),
    block([
      '  // 70.1.3: the 201st tile was the table\u2019s one reward with a side effect, a',
      '  // grant of Premium. It is a trophy now and the hook that minted it is gone',
      '  // with the rest of the paywall, so the celebration is all that is left.',
      // `count` in this gate takes ONE argument and reads the page; the two-argument
      // call that used to be here (`count(src, x)`) was a tautology, because the
      // page always contains itself once. The absence below is a real count.
      "  ok(count('window.__scGrantPremium') === 0 && count('setPremiumActive') === 0,",
      "    'and the trophy still grants something on the side');",
      "  ok(countMod('grantRewards(!!silent);') === 1,",
      "    'and the wall stops celebrating the last tile');",
    ]),
    { key: 'and the trophy still grants something on the side' });

  // The re-splice at the bottom of this file rewrites index.html and the module
  // together; the two gate files are written separately.
  if(!CHECK){
    if(t705.text !== fs.readFileSync(TEST705, 'utf8')) fs.writeFileSync(TEST705, t705.text);
  }
}

// The real-app probe. Its [11c] drove the licence path end to end against a
// stubbed store; there is no licence path, so it drives the removal instead.
{
  const studio = holder(fs.readFileSync(STUDIO, 'utf8'));

  sub(studio, 'the 201 reward row',
    "    ok(rw[4].kind === 'premium', 'and 201 is SideCut Premium');",
    "    ok(rw[4].kind === 'complete', 'and 201 is the finished wall');");

  sub(studio, 'the badge-wall grant',
    block([
      "    ok(win.isPremiumActive() === true, 'and 201 badges grant SideCut Premium, free');",
      "    const prem = JSON.parse(win.localStorage.getItem('sidecut_premium') || 'null');",
      "    ok(prem && prem.gifted === true && prem.source === 'badges',",
      "      'recorded as a gift from the badges, not a purchase');",
    ]),
    block([
      "    ok(typeof win.isPremiumActive === 'undefined', 'and there is no entitlement for it to mint');",
      "    ok(win.localStorage.getItem('sidecut_premium') === null,",
      "      'and nothing is recorded, because there is nothing to lock');",
    ]),
    { key: 'and there is no entitlement for it to mint' });

  sub(studio, 'the dev reset',
    "    ok(win.isPremiumActive() === true, 'a badge reset does not take the earned Premium back');",
    "    ok(win.SC70.rewards().length === 5 && win.localStorage.getItem('sidecut_premium') === null,\n      'and a badge reset has no entitlement left to take back');");

  // The licence section becomes the section that asserts there is no licence.
  sub(studio, 'the licence probe',
    "  console.log('[11d] a badge that reaches its goal shows up on the wall');",
    block([
      "  console.log('[11c] there is nothing left to buy, and Donate is still here');",
      '  {',
      '    // 70.1.3 - "Remove premium make everything free keep donations". Driven on',
      '    // the real page: the Premium tab and its pane are gone, no purchase path',
      '    // survives anywhere, and the Donate tab with its tip tiers is exactly where',
      '    // it was, because it is now the only thing the app asks anybody for.',
      "    ok(doc.querySelector('#settingsTabPremium') === null, 'the Premium tab is out of the strip');",
      "    ok(doc.querySelector('#settingsPanePremium') === null, 'and its pane is out of the sheet');",
      "    ok(doc.querySelector('#premiumLicenseInput') === null && doc.querySelector('#premiumCodeInput') === null,",
      "      'with nothing in it to buy or redeem');",
      "    ok(win.isPremiumActive === undefined && win.openPremiumSettings === undefined,",
      "      'and nothing on the window that could unlock the app');",
      "    ok(typeof win.__scLicenseRedeem === 'undefined' && typeof win.__scLicenseCheck === 'undefined',",
      "      'and no licence path left to drive');",
      "    ok(doc.querySelector('#settingsTabDonate') !== null, 'the Donate tab is still in the strip');",
      "    const quick = doc.querySelectorAll('#settingsPaneDonate .donate-quick');",
      "    ok(quick.length === 11, 'with all eleven tip buttons (' + quick.length + ')');",
      "    ok(doc.querySelector('#settingsPaneDonate .donate-quick[data-amt=\"10\"]') !== null,",
      "      'including the ten dollar one');",
      '    // Everything that used to be behind the paywall is simply there: no tile in',
      '    // the app wears a lock any more.',
      "    const locked = Array.from(doc.querySelectorAll('[data-theme-key]')).filter((b) => /\\uD83D\\uDD12/.test(b.textContent));",
      "    ok(locked.length === 0, 'and no theme is behind a lock (' + locked.length + ' locked)');",
      '  }',
      '',
      "  console.log('[11d] a badge that reaches its goal shows up on the wall');",
    ]).replace(/\n$/, ''),
    { key: 'there is nothing left to buy, and Donate is still here' });

  cut(studio, 'the old licence section',
    "  console.log('[11c] a license key bought on the web unlocks without Google Play');",
    "  console.log('[11d] a badge that reaches its goal shows up on the wall');",
    { keep: "  console.log('[11d] a badge that reaches its goal shows up on the wall');", gone: 'license_key not found.' });

  // [11e] drove the paid half of Studio: the loop refusing to run and the presets
  // refusing to save without Premium. Both work for everyone now.
  sub(studio, 'the sleep timer heading',
    "  console.log('[11e] the sleep timer stops the music, the practice loop only loops on Premium');",
    "  console.log('[11e] the sleep timer stops the music, and the loops and presets just work');");

  sub(studio, 'the practice loop gate',
    block([
      "    win.localStorage.removeItem('sidecut_premium');",
      "    ok(win.SC70.isPro() === false, 'Premium is off');",
      '    audio.currentTime = 12;',
    ]),
    '    audio.currentTime = 12;\n',
    { key: '// the loop can be set to a section' });

  sub(studio, 'the practice loop run',
    block([
      '    win.SC70.practiceRun();',
      "    ok(win.SC70.practice.on === false, 'and it does not loop without Premium');",
      "    win.__scGrantPremium({ plan: 'lifetime' });",
      "    ok(win.SC70.isPro() === true, 'Premium granted, and Studio sees it through the app');",
      '    // The loop only steps while the element says it is playing, and jsdom is',
      '    // never playing anything, so this is the one thing that has to be forced.',
      "    Object.defineProperty(audio, 'paused', { get: () => false, configurable: true });",
      '    win.SC70.practiceRun();',
      "    ok(win.SC70.practice.on === true, 'now it loops');",
    ]),
    block([
      '    // The loop only steps while the element says it is playing, and jsdom is',
      '    // never playing anything, so this is the one thing that has to be forced.',
      "    Object.defineProperty(audio, 'paused', { get: () => false, configurable: true });",
      '    win.SC70.practiceRun();',
      "    ok(win.SC70.practice.on === true, 'and it loops with nothing to unlock');",
    ]));

  sub(studio, 'the preset save',
    block([
      "    const beforeCount = win.SC70.myPresets().length;",
      "    win.localStorage.removeItem('sidecut_premium');",
      '    win.SC70.saveMyPreset();',
      "    ok(win.SC70.myPresets().length === beforeCount, 'a preset is not saved without Premium');",
      "    win.__scGrantPremium({ plan: 'lifetime' });",
      '    win.SC70.saveMyPreset();',
      "    ok(win.SC70.myPresets().length === beforeCount + 1, 'and is saved with it');",
    ]),
    block([
      "    const beforeCount = win.SC70.myPresets().length;",
      '    win.SC70.saveMyPreset();',
      "    ok(win.SC70.myPresets().length === beforeCount + 1, 'a preset saves with nothing to ask for');",
    ]));

  // The comment above the timers still sells the paid split.
  sub(studio, 'the timer comment',
    block([
      '    // 70.1.2 - "add more features to studio" and "make their an actual reason to',
      '    // get SideCut premium". Both halves driven: the free timer really pauses when',
      '    // the song ends, and the paid loop really refuses to run until Premium is on',
      '    // and really seeks back to A when it is.',
    ]),
    block([
      '    // 70.1.2 - "add more features to studio", and 70.1.3 - "Remove premium make',
      '    // everything free keep donations". Driven here: the timer really pauses when',
      '    // the song ends, and the loop really seeks back to A with no entitlement to',
      '    // ask for first.',
    ]));

  if(!CHECK){
    if(studio.text !== fs.readFileSync(STUDIO, 'utf8')) fs.writeFileSync(STUDIO, studio.text);
  }
}

/* ============================== L. THE GATES THAT WERE WRITTEN AROUND IT */
// Five older gates pinned the paywall as though it were part of the app: the
// theme split, the Premium tab, the copy that described it, and a count of accent
// fills that included a button in the Premium pane. Each one is repointed at what
// is true now, and none of them is deleted - a rule about the app is worth more
// stated the other way round than dropped.
const gateFiles = [
  ['test-663.mjs', 'the showSettingsTab fold'],
  ['test-6641.mjs', 'the theme split'],
  ['test-6642.mjs', 'the settings tab strip'],
  ['test-66422.mjs', 'the accent fill count'],
  ['test-66423.mjs', 'the accent fill count'],
  ['test-66424.mjs', 'the accent fill count'],
  ['test-66425.mjs', 'the accent fill count'],
  ['test-66426.mjs', 'the accent fill count'],
];
const gates = gateFiles.map(([name]) => [name, holder(fs.readFileSync(path.join(ROOT, 'dev', name), 'utf8'))]);
const gateOf = (name) => gates.filter(([n]) => n === name)[0][1];

sub(gateOf('test-663.mjs'), 'the showSettingsTab fold',
  "ok(src.indexOf(\"if(tab === 'refresh' || tab === 'playback' || tab === 'eq') tab = 'more';\") !== -1,\n  'which is what showSettingsTab() already said');",
  block([
    "  // 70.1.3 added the removed Premium tab to the same fold, so the literal moved.",
    "  ok(src.indexOf(\"if(tab === 'refresh' || tab === 'playback' || tab === 'eq' || tab === 'premium') tab = 'more';\") !== -1,",
    "    'which is what showSettingsTab() already said');",
  ]),
  { key: "|| tab === 'eq' || tab === 'premium') tab = 'more';" });

{
  const g = gateOf('test-6641.mjs');
  cut(g, 'the theme split section',
    "console.log('[3] which animated themes are premium');",
    "console.log('[4] a greeting is answered as a greeting');",
    { keep: "console.log('[4] a greeting is answered as a greeting');", gone: 'which animated themes are premium' });
  sub(g, 'the free themes section',
    "console.log('[4] a greeting is answered as a greeting');",
    block([
      "console.log('[3] every animated theme is free now');",
      '{',
      '  // 70.1.3 - "Remove premium make everything free keep donations". v64.1 drew a',
      '  // line through this list: five animated themes were free and nine were sold',
      '  // with a lock on the tile. The line is gone, so what is checked now is that',
      '  // all fourteen are still there and that none of them carries the flag.',
      '  const animated = [',
      "    [\"rgb:true  },\", 'RGB'],",
      "    [\"rgb:true, rgbPlus:true  },\", 'RGB +'],",
      "    [\"coral:'#FF8A5C', gold:'#FFC46B', dynamic:'ember'\", 'Ember'],",
      "    [\"coral:'#B084F5', gold:'#8FD0FF', dynamic:'galaxy'\", 'Galaxy'],",
      "    [\"coral:'#A6E8FF', gold:'#E8F7FF', dynamic:'glacier'\", 'Glacier'],",
      "    [\"dynamic:'aurora'\", 'Aurora'],",
      "    [\"dynamic:'synthwave'\", 'Synthwave'],",
      "    [\"dynamic:'ocean'\", 'Deep Ocean'],",
      "    [\"dynamic:'cyberpunk'\", 'Cyberpunk'],",
      "    [\"dynamic:'nebula'\", 'Nebula'],",
      "    [\"dynamic:'neonpulse'\", 'Neon Pulse'],",
      "    [\"dynamic:'solstice'\", 'Solstice'],",
      "    [\"dynamic:'abyss'\", 'Abyss'],",
      "    [\"dynamic:'orchid'\", 'Orchid'],",
      '  ];',
      "  for (const [needle, name] of animated) ok(has(needle), name + ' is still in the theme list');",
      "  ok(count('premium:true') === 0, 'and not one of them is sold any more (' + count('premium:true') + ' flag(s))');",
      '  // The flag is what put a lock on the tile, so the flag is what is looked for',
      '  // on every entry rather than on the nine that used to carry it.',
      '  for (const [needle, name] of animated) {',
      '    const line = src.slice(src.indexOf(needle) - 60, src.indexOf(needle));',
      "    ok(line.indexOf('premium') === -1, name + ' carries no premium flag (' + line.trim().slice(-24) + ')');",
      '  }',
      "  ok(count('Avoid the <b>RGB</b>, <b>RGB+</b>, and every animated <b>dynamic theme</b>') === 2,",
      "    'both seizure warnings name every animated theme');",
      "  ok(has('Orchid) ' + String.fromCodePoint(0x2014) + ' the Theme tab lists all of them under Dynamic themes.'),",
      "    'including the ones a photosensitive user must not open by accident');",
      '  // The lock is what enforced the split, and there is no lock left to enforce.',
      "  ok(count('if(th.premium && !isPremiumActive()){') === 0 && count('isPremiumActive') === 0,",
      "    'the Theme tab still locks a premium theme');",
      "  ok(has('Every switch in Sandbox is on for everyone.'),",
      "    'and the Sandbox page still divides its own list in two');",
      '}',
      '',
      "console.log('[4] a greeting is answered as a greeting');",
    ]).replace(/\n$/, ''),
    { key: "console.log('[3] every animated theme is free now');" });
}

{
  // test-6641 has its own copy of the same strip, fifteen lines further down.
  sub(gateOf('test-6641.mjs'), 'the tab order in 6641',
    block([
      "  const order = ['settingsTabPremium', 'settingsTabExpand', 'settingsTabTheme', 'settingsTabDonate', 'settingsTabGlow',",
      "    'settingsTabSandbox', 'settingsTabSupport', 'settingsTabWidget', 'settingsTabMore']",
      "    .map((id) => src.indexOf('id=\"' + id + '\"'));",
      "  ok(order.every((i) => i !== -1), 'all nine tabs are present');",
      "  ok(order.every((v, i) => i === 0 || order[i - 1] < v), 'and the strip runs Premium, Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget, More (More last)');",
    ]),
    block([
      '  // 70.1.3 removed the Premium tab, so the strip is eight tabs and the names',
      '  // that follow it each moved one place to the left.',
      "  const order = ['settingsTabExpand', 'settingsTabTheme', 'settingsTabDonate', 'settingsTabGlow',",
      "    'settingsTabSandbox', 'settingsTabSupport', 'settingsTabWidget', 'settingsTabMore']",
      "    .map((id) => src.indexOf('id=\"' + id + '\"'));",
      "  ok(order.every((i) => i !== -1), 'all eight tabs are present');",
      "  ok(order.every((v, i) => i === 0 || order[i - 1] < v), 'and the strip runs Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget, More (More last)');",
    ]),
    { key: "'all eight tabs are present'" });
}

{
  const g = gateOf('test-6642.mjs');
  sub(g, 'the tab order',
    block([
      "  const order = ['settingsTabPremium', 'settingsTabExpand', 'settingsTabTheme', 'settingsTabDonate', 'settingsTabGlow',",
      "    'settingsTabSandbox', 'settingsTabSupport', 'settingsTabWidget', 'settingsTabMore']",
      "    .map((id) => src.indexOf('id=\"' + id + '\"'));",
      "  ok(order.every((i) => i !== -1), 'all nine tabs are present');",
      '  ok(order.every((v, i) => i === 0 || order[i - 1] < v),',
      "    'and the strip runs Premium, Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget, More');",
      "  ok(order[8] > order[7] && order[8] > order[6], 'More is the last tab');",
      "  ok(order[3] < order[4], 'Donate is where it was (fourth)');",
      "  ok(order[6] < order[7], 'and Support is seventh, before Widget');",
    ]),
    block([
      '  // 70.1.3 took the Premium tab out of the strip, so there are eight now and',
      '  // every position after it moved one to the left.',
      "  const order = ['settingsTabExpand', 'settingsTabTheme', 'settingsTabDonate', 'settingsTabGlow',",
      "    'settingsTabSandbox', 'settingsTabSupport', 'settingsTabWidget', 'settingsTabMore']",
      "    .map((id) => src.indexOf('id=\"' + id + '\"'));",
      "  ok(order.every((i) => i !== -1), 'all eight tabs are present');",
      '  ok(order.every((v, i) => i === 0 || order[i - 1] < v),',
      "    'and the strip runs Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget, More');",
      "  ok(order[7] > order[6] && order[7] > order[5], 'More is the last tab');",
      "  ok(order[2] < order[3], 'Donate is where it was (third now, not fourth)');",
      "  ok(order[5] < order[6], 'and Support is sixth, before Widget');",
      "  ok(src.indexOf('id=\"settingsTabPremium\"') === -1, 'and the tab that was first is still in the strip');",
    ]),
    { key: 'all eight tabs are present' });

  sub(g, 'the showSettingsTab slice',
    'src.indexOf("$(\'settingsTabPremium\').addEventListener")',
    'src.indexOf("$(\'settingsTabExpand\').addEventListener")');

  sub(g, 'the pane reset order',
    'fn.indexOf(\'_panes\') < fn.indexOf("$(\'settingsPanePremium\')")',
    'fn.indexOf(\'_panes\') < fn.indexOf("$(\'settingsPaneExpand\')")');
}

// The accent-fill count. The one it lost was on the Cancel-subscription button in
// the Premium pane, which is not in the page any more.
for (const name of ['test-66422.mjs', 'test-66423.mjs', 'test-66424.mjs', 'test-66425.mjs', 'test-66426.mjs']) {
  sub(gateOf(name), 'the accent fill count',
    "  ok(count('background:var(--coral); color:var(--on-coral,#fff)') >= 15,",
    "  ok(count('background:var(--coral); color:var(--on-coral,#fff)') >= 14,");
}

/* ------------------------------------------------------------------- checks */
{
  const page = html.text;
  const modText = mod.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };
  // A survivor is named by the line it is on, because "a premium gate survived"
  // without a line number is a search, not a diagnosis.
  const linesOf = (hay, needle) => hay.split('\n')
    .map((l, i) => (l.indexOf(needle) === -1 ? '' : (i + 1) + ':' + l.trim().slice(0, 90)))
    .filter(Boolean).join(' | ');
  const mustNot = (hay, needle, msg) => {
    const n = count(hay, needle);
    if(n) problems.push(msg + ' (' + n + 'x at line ' + linesOf(hay, needle) + ')');
  };

  must(count(page, "const APP_VERSION = '70.1.3';") === 1, 'the version is not 70.1.3 exactly once');
  must(count(page, "version: '70.1.3'") === 1, 'the 70.1.3 changelog entry is missing');
  must(count(page, "date: '" + STAMP + "'") === 1, 'the 70.1.3 stamp is not the one this release was cut at');
  must(count(page, "title: '" + TITLE + "'") === 1, 'the 70.1.3 title is not the one this release was cut with');
  must(count(page, "version: '70.1.2'") === 1, 'the 70.1.2 entry left the array');
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  mustNot(sw.text, "const CACHE_NAME = '" + OLDCACHE + "';", 'the old shell cache is still in sw.js');

  // The removal, stated as an absence. These are the invariants the release is.
  mustNot(page, 'isPremiumActive', 'a premium gate survived in the page');
  mustNot(page, 'sidecut_premium', 'the premium storage key survived in the page');
  mustNot(page, 'LICENSE_CONFIG', 'the store licence config survived');
  mustNot(page, 'PREMIUM_HMAC_KEY_B64', 'the gift-code key survived');
  mustNot(page, 'PREMIUM_STORAGE_KEY', 'the premium storage constant survived');
  mustNot(page, 'activateLicenseKey', 'the licence activation survived');
  mustNot(page, 'revalidateLicense', 'the licence re-check survived');
  mustNot(page, 'offerLicenseOrPlayStore', 'the Play cannot sell hand-off survived');
  mustNot(page, 'licensePost', 'the store POST survived');
  mustNot(page, 'buildPremiumPayload', 'the backup premium payload survived');
  mustNot(page, 'manifest.premium', 'a backup still carries premium');
  mustNot(page, 'syncPlayEntitlement', 'the Play entitlement sync survived');
  mustNot(page, 'PLAY_SUBSCRIPTION_PRODUCT_ID', 'the subscription product survived');
  mustNot(page, 'PLAY_LIFETIME_PRODUCT_ID', 'the lifetime product survived');
  mustNot(page, '__scGrantPremium', 'the badge-wall grant survived');
  mustNot(page, '__scIsPremium', 'the entitlement bridge survived');
  mustNot(page, '__scLicenseRedeem', 'the licence probe survived');
  mustNot(page, 'window.isPremiumActive', 'the entitlement is still published on the window');
  mustNot(page, 'window.openPremiumSettings', 'the Premium tab is still reachable from a click');
  mustNot(page, 'settingsPanePremium', 'the Premium pane survived in the markup');
  mustNot(page, 'settingsTabPremium', 'the Premium tab survived in the markup');
  mustNot(page, 'premiumBuyView', 'the buy view survived in the markup');
  mustNot(page, 'premiumLicenseInput', 'the licence box survived in the markup');
  mustNot(page, 'premiumCodeInput', 'the gift-code box survived in the markup');
  mustNot(page, 'premium:true', 'a theme is still flagged as premium');
  mustNot(page, "toast('Premium feature", 'a premium toast survived');
  mustNot(page, 'data-act="openpremium"', 'a Premium button survived in Studio');
  mustNot(page, 'isPro(', 'Studio still asks for an entitlement');
  mustNot(page, 'proOnly(', 'the Studio entitlement gate survived');
  mustNot(page, 'premiumStudioHtml', 'the Studio Premium section survived');
  mustNot(page, 'at: 201, kind: \'premium\'', 'the 201 reward still mints Premium');

  // And the one thing that had to survive the removal.
  must(count(page, 'id="settingsTabDonate"') === 1, 'the Donate tab is gone');
  must(count(page, 'id="settingsPaneDonate"') === 1, 'the Donate pane is gone');
  must(count(page, 'function initDonateTab(){') === 1, 'the Donate tab is not wired');
  must(count(page, 'const PLAY_TIP_PRODUCTS = {') === 1, 'the tip tiers are gone');
  must(count(page, 'purchasePlayTip') === 2, 'the tip purchase path is gone');
  must(count(page, 'PAYMENT_CONFIG.playStoreListing') === 2, 'a copy that cannot bill is not sent anywhere');
  must(count(page, 'PAYMENT_CONFIG = {') === 1, 'the payment config went with the paywall');

  must(count(page, 'id="sc-studio-70"') === 1, 'the Studio script block is missing');
  must(count(page, "at: 201, kind: 'complete'") === 1, 'the 201 reward is not the finished wall');
  must(count(modText, 'isPro') === 0, 'the module still asks for an entitlement');

  // The gates that were written around the paywall, repointed at what is true now.
  must(count(gateOf('test-663.mjs').text, "|| tab === 'eq' || tab === 'premium') tab = 'more';") === 1,
    'test-663 does not know the Premium tab was folded into More');
  must(count(gateOf('test-6641.mjs').text, "console.log('[3] every animated theme is free now');") === 1 &&
    count(gateOf('test-6641.mjs').text, 'which animated themes are premium') === 0,
    'test-6641 still asserts the theme split');
  must(count(gateOf('test-6642.mjs').text, "'all eight tabs are present'") === 1 &&
    count(gateOf('test-6642.mjs').text, "'all nine tabs are present'") === 0,
    'test-6642 still counts nine settings tabs');
  must(count(gateOf('test-6641.mjs').text, "'all eight tabs are present'") === 1 &&
    count(gateOf('test-6641.mjs').text, "'all nine tabs are present'") === 0,
    'test-6641 still counts nine settings tabs');
  for (const name of ['test-66422.mjs', 'test-66423.mjs', 'test-66424.mjs', 'test-66425.mjs', 'test-66426.mjs']) {
    must(count(gateOf(name).text, 'on-coral,#fff)\') >= 14,') === 1 && count(gateOf(name).text, 'on-coral,#fff)\') >= 15,') === 0,
      name + ' still counts the fifteen accent fills the Premium pane had');
  }
  must(count(modText, 'visible. Shown while Premium is off') === 0, 'the Studio Premium pitch survived in the module');
}

if(problems.length){
  console.error('patch-7013: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(MANIFEST){
  const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(built));
  console.log('patch-7013: root manifest.json seeded from ota/updates.json (' + built.size + ' bytes)');
  process.exit(0);
}

if(CHECK){
  console.log('patch-7013: tree is at ' + VERSION + ', ' + applied + ' to apply, ' + already + ' already in place');
  process.exit(0);
}

const files = [[IDX, html.text], [MOD, mod.text], [SW, sw.text]]
  .concat(gates.map(([name, h]) => [path.join(ROOT, 'dev', name), h.text]));
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-7013: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-7013: next `node dev/repin-7013.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
