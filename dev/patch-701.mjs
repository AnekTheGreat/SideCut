#!/usr/bin/env node
/**
 * SideCut 70.1 - the APK gets a way to be paid for.
 *
 * The user asked, after being told Play Billing cannot sell to a sideloaded
 * build:
 *
 *   "Why won't it work on the apk can't we do smth else"
 *
 * and then chose the answer:
 *
 *   "APK payment: License key + web checkout"
 *
 * WHY PLAY CANNOT DO IT. Play Billing is not a payment API the app calls - it is
 * a purchase made THROUGH the Play Store, and the Play Store only sells for a
 * package it recognises as its own, installed by Play. The APK distributed here
 * is the `full` flavour (`com.SideCut.myapp.full`), a deliberately different
 * package id so it can be installed side by side with the Play copy, and Play
 * has never heard of it. There is nothing to charge for. That is a property of
 * the distribution channel, not a bug in the wiring, and no amount of code fixes
 * it - which is why the answer has to be a different way to pay.
 *
 * THE WAY TO PAY. The store's own customer-facing licence API. The buyer checks
 * out on the web (card, wallets, whatever the store offers), the store issues a
 * licence key and emails it, and the key is pasted into Settings -> Premium. The
 * store's activate call records this device as an activation, validate is the
 * source of truth afterwards, and deactivate gives the slot back when the user
 * removes premium. Nothing secret is involved: those three endpoints take
 * nothing but the key itself, which is exactly why a static, backendless app can
 * use them. (Contrast the gift codes above: their HMAC key is in this file, so
 * they are for giving away, never for selling.)
 *
 * WHICH STORE. Lemon Squeezy, whose endpoints are the defaults in LICENSE_CONFIG
 * (merchant of record, so VAT is handled, and it issues licence keys for a
 * product out of the box). It is written as a configuration block precisely
 * because that is not a permanent decision: changing store is those three URLs
 * plus the two id fields, and no other line in the app knows who sold the key.
 * The user has not picked one yet, so `checkoutUrl` ships EMPTY and every button
 * that would open it says the checkout is not open yet instead of opening a dead
 * link. Filling that one line starts selling.
 *
 * WHAT MUST NOT BREAK. The Play path (subscription + lifetime) is untouched for
 * the copy installed from Play, gift codes are untouched, and both paying paths
 * end in the same premium. The rules that matter and are asserted below: no
 * secret in the file, the unlock survives a store that cannot be reached, and
 * only the store saying "not valid" can lock a paying user out.
 *
 *   node dev/patch-701.mjs            # apply
 *   node dev/patch-701.mjs --check    # report only, change nothing
 *   node dev/patch-701.mjs --manifest # reseed the root manifest.json only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const STUDIO = path.join(ROOT, 'dev', 'studio-70-check.cjs');
const TEST662 = path.join(ROOT, 'dev', 'test-662.mjs');
const TEST70 = path.join(ROOT, 'dev', 'test-70.mjs');

const CHECK = process.argv.includes('--check');
const MANIFEST = process.argv.includes('--manifest');
const VERSION = '70.1';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// Built at 2026-09-29 20:11 UTC = 4:11 PM EDT, the same day. A stamp in the
// FUTURE is a gate failure (test-6643: "not one of them in the future").
const STAMP = 'September 29, 2026 \u00b7 4:11 PM EDT';
const CACHE = 'sidecut-shell-v63.0.36';
const OLDCACHE = 'sidecut-shell-v63.0.35';
const TITLE = 'The APK stops being unpayable: a card checkout on the web issues a license key that unlocks the same Premium the Play copy buys';

// Six notes, none with an apostrophe (a note is emitted into a single-quoted
// literal) and none with a downloader term or the words "play build", "play
// version" or "play install" - test-662 and test-6139 both refuse those.
const NOTES = [
  'The APK can be paid for now. Google Play Billing only sells to a copy of an app that came from Google Play, and this package is a separate one with its own id, so Play had nothing to charge for - the buttons in Settings that used to end in a Play error now open a real card checkout instead.',
  'Paying there gets you a license key by email, and that key is the unlock: paste it under Paid by card in Settings, and the store is asked to record this device, so the app knows a real sale happened and you can move the key to your next phone.',
  'The key is only checked once. After that the app is unlocked offline like the rest of it is, and the store is asked again quietly in the background about once a week - a lookup that fails changes nothing at all, and only the store actually saying the key is no longer valid takes the unlock away.',
  'This changes nothing for the copy of SideCut sold through Google Play: Play Billing is exactly as it was there, and both ways of paying unlock the same Premium, so a keyed copy and a purchased one are the same app from then on.',
  'Gift codes still work exactly as before, which is the point of them - they are minted by hand and given away, and nothing about them moved. The new keys are the ones checked by the store, so a refund or a deactivated key really does stop working.',
  'Removing premium hands your activation back, so a key with a device limit does not fill up with phones you no longer own, and your key travels inside your backup the way every other unlock does.',
];

const problems = [];
let applied = 0, already = 0;

const count = (hay, needle) => hay.split(needle).length - 1;

function holder(text){ return { text: text }; }

// A correction that must NOT fail when there is nothing to correct, for the same
// reason patch-708/patch-709 have one: index.html is far too large to edit by
// hand and far too load-bearing to revert.
function heal(h, label, from, to){
  const n = count(h.text, from);
  if(n === 0) return;
  h.text = h.text.split(from).join(to);
  applied++;
  console.log('patch-701: healed ' + label + ' (' + n + ')');
}

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

const block = (lines) => lines.join('\n') + '\n';

/* ------------------------------------------------- the licence configuration */
const LICENSE_CONFIG_BLOCK = block([
  '  // ---- LICENSING: the way this app is paid for outside Google Play --------',
  '  // Play Billing is not a payment API the app can call - it is a purchase made',
  '  // THROUGH the Play Store, and the Play Store only sells for a package it',
  '  // recognises as its own, installed by Play. The APK handed out here is the',
  '  // `full` flavour (com.SideCut.myapp.full): a deliberately different package id',
  '  // so it can sit next to the Play copy, and Play has never heard of it. So the',
  '  // APK - and the plain browser, which has no Billing at all - is paid for here',
  '  // instead: the buyer checks out on the web, the store issues a licence key and',
  '  // emails it, and the key is pasted into Settings -> Premium below.',
  '  //',
  '  // NOTHING SECRET GOES IN THIS OBJECT. The endpoints are the store customer-',
  '  // facing licence API: they take nothing but the key itself, so there is no',
  '  // shared secret in this file to dig out, and lifting this whole block out of',
  '  // the page gets an attacker exactly what every paying customer already has.',
  '  // (The gift-code HMAC key above is a different story, and it is why gift codes',
  '  // are for giving away and not for selling.)',
  '  const LICENSE_CONFIG = {',
  '    // Where the buyer pays: the product checkout link from the store dashboard.',
  '    // EMPTY means selling has not been switched on yet, and every button that',
  '    // would open it says so instead of opening a dead link. Filling this line in',
  '    // is the whole of what is left to do.',
  '    checkoutUrl: \'\',',
  '    // The store licence API. These defaults are Lemon Squeezy\'s, which is the',
  '    // store this was written against: validate/activate/deactivate take no API',
  '    // key, which is the entire reason a static app can use them. Changing store',
  '    // is these three lines and the two id fields below - nothing else in the app',
  '    // knows or cares who sold the key.',
  '    validateUrl: \'https://api.lemonsqueezy.com/v1/licenses/validate\',',
  '    activateUrl: \'https://api.lemonsqueezy.com/v1/licenses/activate\',',
  '    deactivateUrl: \'https://api.lemonsqueezy.com/v1/licenses/deactivate\',',
  '    // 0 means "do not check". Set either to the store/product ids the keys are',
  '    // issued for and a key from somebody else\'s product is refused outright',
  '    // instead of unlocking this app.',
  '    storeId: 0,',
  '    productId: 0,',
  '    // How long a licence is trusted without asking the store again. The store',
  '    // stays the source of truth; this is what keeps the app unlocked on a plane.',
  '    // A lookup that FAILS never locks anything - only the store saying "not',
  '    // valid" does.',
  '    revalidateMs: 7 * 24 * 60 * 60 * 1000,',
  '  };',
]);

/* --------------------------------------------------- the licence-key machinery */
const LICENSE_HELPERS = block([
  '  // ---- licence keys: paying for the APK without Google Play ----------------',
  '  // One device label per install, kept in localStorage. It names the activation',
  '  // in the store dashboard ("SideCut android 3f9a2b"), so a buyer who runs out of',
  '  // activations can see which device to drop.',
  '  const LICENSE_INSTALL_KEY = \'sidecut_install_id\';',
  '  function licenseInstallId(){',
  '    try{',
  '      const seen = localStorage.getItem(LICENSE_INSTALL_KEY);',
  '      if(seen && /^[0-9a-z]{8,16}$/.test(seen)) return seen;',
  '      const bytes = new Uint8Array(6);',
  '      crypto.getRandomValues(bytes);',
  '      let out = \'\';',
  '      for(const b of bytes) out += (\'0\' + b.toString(36)).slice(-2);',
  '      localStorage.setItem(LICENSE_INSTALL_KEY, out);',
  '      return out;',
  '    }catch(_e){ return \'nodevice\'; }',
  '  }',
  '  function licenseInstanceName(){',
  '    let plat = \'web\';',
  '    try{ if(window.Capacitor && window.Capacitor.getPlatform) plat = window.Capacitor.getPlatform(); }catch(_e){ }',
  '    if(plat === \'web\') plat = \'browser\';',
  '    return \'SideCut \' + plat + \' \' + licenseInstallId();',
  '  }',
  '  function openExternal(url){',
  '    try { window.open(url, \'_blank\', \'noopener\'); } catch(e){ window.location.href = url; }',
  '  }',
  '  // The store licence API, spoken the way it documents itself: form-encoded, and',
  '  // only the fields that have a value. x-www-form-urlencoded plus Accept is a CORS',
  '  // "simple" request, so there is no preflight to fail, and the store answers with',
  '  // Access-Control-Allow-Origin: * - which is why this works from the browser and',
  '  // from the app WebView alike. (In the installed app CapacitorHttp takes the call',
  '  // over before the WebView sees it, so it is not subject to CORS at all.)',
  '  async function licensePost(url, fields){',
  '    // URLSearchParams, because this is a form body: a space in the activation',
  '    // name has to go out as a + the way a browser form sends it, and it is the',
  '    // one encoder that is right about that everywhere.',
  '    const params = new URLSearchParams();',
  '    Object.keys(fields).forEach((k) => {',
  '      if(fields[k] === undefined || fields[k] === null || fields[k] === \'\') return;',
  '      params.append(k, fields[k]);',
  '    });',
  '    const body = params.toString();',
  '    const res = await fetch(url, {',
  '      method: \'POST\',',
  '      headers: { \'Accept\': \'application/json\', \'Content-Type\': \'application/x-www-form-urlencoded\' },',
  '      body: body,',
  '    });',
  '    let data = null;',
  '    try{ data = await res.json(); }catch(_e){ data = null; }',
  '    // A refusal is a 404 WITH a real body ("license_key not found."), so the body',
  '    // is what decides - never the status code. No readable body is the case that',
  '    // must not be mistaken for a refusal: that is the store being unreachable or',
  '    // having moved, and it must never lock anybody out of what they paid for.',
  '    if(!data || typeof data !== \'object\') throw new Error(\'the store answered \' + res.status + \' with no readable body\');',
  '    return data;',
  '  }',
  '  // Tells a licence key from a gift code, because they share the pane. A gift code',
  '  // is SC-xxxxxxxx-xxxxxxxx; a licence key is whatever the store issues (a',
  '  // 36-character uuid-shaped string by default) and is never that shape.',
  '  function licenseShaped(code){',
  '    const s = String(code || \'\').trim();',
  '    if(/^SC-[0-9A-Za-z]{8}-[0-9A-Za-z]{8}$/.test(s)) return false;',
  '    return /^[0-9A-Za-z][0-9A-Za-z-]{15,79}$/.test(s);',
  '  }',
  '  function licenseBelongsToThisStore(meta){',
  '    if(!meta) return true;',
  '    if(LICENSE_CONFIG.storeId && Number(meta.store_id) !== Number(LICENSE_CONFIG.storeId)) return false;',
  '    if(LICENSE_CONFIG.productId && Number(meta.product_id) !== Number(LICENSE_CONFIG.productId)) return false;',
  '    return true;',
  '  }',
  '  function setPremiumChecked(){',
  '    try{',
  '      const info = getPremiumInfo();',
  '      if(!info) return;',
  '      info.checked = Date.now();',
  '      localStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify(info));',
  '    }catch(_e){ }',
  '  }',
  '  // Redeem a key bought on the web. The store activate call is what records this',
  '  // device as an activation, so a device limit means something and a buyer who',
  '  // changes phone can move the licence. Only a real answer unlocks: an unreachable',
  '  // store reports itself as such and changes nothing.',
  '  async function activateLicenseKey(key){',
  '    const clean = String(key || \'\').trim();',
  '    if(!licenseShaped(clean)) return { ok: false, reason: \'shape\' };',
  '    let data;',
  '    try{',
  '      data = await licensePost(LICENSE_CONFIG.activateUrl, {',
  '        license_key: clean,',
  '        instance_name: licenseInstanceName(),',
  '      });',
  '    }catch(e){',
  '      return { ok: false, reason: \'offline\', detail: String((e && e.message) || e) };',
  '    }',
  '    if(!data || data.activated !== true){',
  '      return { ok: false, reason: \'refused\', detail: String((data && data.error) || \'\') };',
  '    }',
  '    if(!licenseBelongsToThisStore(data.meta)) return { ok: false, reason: \'wrong-product\' };',
  '    const inst = data.instance || {};',
  '    setPremiumActive({',
  '      plan: \'license\',',
  '      code: clean,',
  '      source: \'license\',',
  '      instance: inst.id || \'\',',
  '      instanceName: inst.name || \'\',',
  '      licensee: (data.meta && data.meta.customer_email) || \'\',',
  '      checked: Date.now(),',
  '    });',
  '    return { ok: true, meta: data.meta || {} };',
  '  }',
  '  // The store stays the source of truth. This runs on launch, on focus and on',
  '  // return to the app, and only asks when the last answer is old (a week), which',
  '  // is what keeps the app working offline. A lookup that fails changes nothing:',
  '  // the ONLY way a licence locks is the store itself saying it is no longer valid',
  '  // (refunded, deactivated, expired) - that is the point of paying for a licence',
  '  // instead of typing in a code.',
  '  let licenseCheckInFlight = false;',
  '  async function revalidateLicense(){',
  '    if(licenseCheckInFlight) return false;',
  '    const info = getPremiumInfo();',
  '    if(!info || info.plan !== \'license\' || !info.code) return false;',
  '    const since = Number(info.checked) || 0;',
  '    if(since && Date.now() - since < LICENSE_CONFIG.revalidateMs) return false;',
  '    licenseCheckInFlight = true;',
  '    let data = null;',
  '    try{',
  '      data = await licensePost(LICENSE_CONFIG.validateUrl, {',
  '        license_key: info.code,',
  '        instance_id: info.instance || \'\',',
  '      });',
  '    }catch(_e){',
  '      licenseCheckInFlight = false;',
  '      return false;   // unreachable store: the unlock stays, untouched',
  '    }',
  '    licenseCheckInFlight = false;',
  '    if(data.valid === true){ setPremiumChecked(); return true; }',
  '    if(data.valid === false){',
  '      clearPremiumQuietly();',
  '      try{ toast(\'This license key is no longer valid, so Discover is locked again. Paste it again if that looks wrong.\', 6500); }catch(_e){ }',
  '      return true;',
  '    }',
  '    return false;',
  '  }',
  '  // Give this device activation back when the user removes premium, so a licence',
  '  // with a device limit does not fill up with phones they no longer have. Best',
  '  // effort by design: the local removal must never wait on the network.',
  '  function releaseLicenseActivation(){',
  '    const info = getPremiumInfo();',
  '    if(!info || info.plan !== \'license\' || !info.code || !info.instance) return;',
  '    if(!LICENSE_CONFIG.deactivateUrl) return;',
  '    try{ licensePost(LICENSE_CONFIG.deactivateUrl, { license_key: info.code, instance_id: info.instance }); }catch(_e){ }',
  '  }',
  '  // The end of a Play purchase that Play cannot complete. With a web checkout',
  '  // configured this is where the APK and the browser get their money taken; with',
  '  // none it is exactly the behaviour that shipped before, unchanged.',
  '  function offerLicenseOrPlayStore(msgEl, playUrl){',
  '    if(LICENSE_CONFIG.checkoutUrl){',
  '      msgEl.style.color = \'var(--ink-dim)\';',
  '      msgEl.textContent = \'Google Play billing only works for the copy of SideCut installed from Google Play, and this is not that copy. Opening the web checkout - pay by card there and paste the license key it emails you into the box under the plans.\';',
  '      openExternal(LICENSE_CONFIG.checkoutUrl);',
  '      return;',
  '    }',
  '    if(!playUrl){',
  '      msgEl.style.color = \'var(--coral)\';',
  '      msgEl.textContent = \'Play billing only works inside the SideCut app installed from Google Play, and the web checkout is not open yet - check back soon.\';',
  '      return;',
  '    }',
  '    msgEl.style.color = \'var(--ink-dim)\';',
  '    msgEl.textContent = \'Play billing only works inside the SideCut app installed from Google Play. Opening the Play Store so you can install it.\';',
  '    openExternal(playUrl);',
  '  }',
]);

/* ------------------------------------------------------- the buy-view markup */
const LICENSE_MARKUP = block([
  '        <!-- Paid by card on the web: the APK and the browser cannot use Play -->',
  '        <div style="border-top:1px solid var(--line); padding-top:16px; margin-top:16px;">',
  '          <div style="font-size:14px; font-weight:600; margin-bottom:4px;">Paid by card? Paste your license key</div>',
  '          <div style="font-size:12px; color:var(--ink-dim); line-height:1.5; margin-bottom:10px;">The copy of SideCut from Google Play is paid for through Play. Everywhere else — the APK, the web app — is paid for on the web: the store emails a license key when you buy, and pasting it here unlocks Discover on this device.</div>',
  '          <div style="display:flex; gap:8px; margin-bottom:10px;">',
  '            <input type="text" id="premiumLicenseInput" placeholder="Paste your license key" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" style="flex:1; min-width:0; background:var(--bg); border:1px solid var(--line); color:var(--ink); border-radius:8px; padding:10px 12px; font-size:13px; font-family:\'JetBrains Mono\',monospace;">',
  '            <button id="premiumLicenseBtn" style="padding:10px 16px; border-radius:8px; background:var(--bg-raised); border:1px solid var(--coral); color:var(--coral); font-size:13px; font-weight:600; cursor:pointer;">Unlock</button>',
  '          </div>',
  '          <button id="premiumLicenseBuyBtn" style="width:100%; background:var(--bg); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:11px 12px; font-size:13px; font-weight:600; cursor:pointer;">💳 Buy lifetime — $10 on the web</button>',
  '          <div id="premiumLicenseMsg" style="font-size:12px; color:var(--ink-dim); min-height:16px; line-height:1.5; margin-top:8px;"></div>',
  '        </div>',
]);

/* ------------------------------------------------------ the buy-view wiring */
const LICENSE_WIRING = block([
  '    // Paid by card on the web (the APK and the browser). The key is checked with',
  '    // the store, and only a real answer from the store unlocks anything.',
  '    const licInput = $(\'premiumLicenseInput\');',
  '    const licBtn = $(\'premiumLicenseBtn\');',
  '    const licBuy = $(\'premiumLicenseBuyBtn\');',
  '    const licMsg = $(\'premiumLicenseMsg\');',
  '    function licenseSay(colour, text){ if(!licMsg) return; licMsg.style.color = colour; licMsg.textContent = text; }',
  '    function licenseOpenCheckout(){',
  '      if(!LICENSE_CONFIG.checkoutUrl){',
  '        licenseSay(\'var(--ink-dim)\', \'The web checkout is not open yet — check back soon, and thank you for wanting to pay for it.\');',
  '        return;',
  '      }',
  '      licenseSay(\'var(--ink-dim)\', \'Opening the checkout — pay by card there and the store will email you a license key. Paste it here when it arrives.\');',
  '      openExternal(LICENSE_CONFIG.checkoutUrl);',
  '    }',
  '    if(licBuy) licBuy.addEventListener(\'click\', licenseOpenCheckout);',
  '    async function doLicenseRedeem(){',
  '      const key = licInput ? licInput.value.trim() : \'\';',
  '      if(!key){',
  '        licenseSay(\'var(--coral)\', \'Paste the license key from your receipt email.\');',
  '        return;',
  '      }',
  '      licenseSay(\'var(--ink-dim)\', \'Checking that key with the store…\');',
  '      const out = await activateLicenseKey(key);',
  '      if(out.ok){',
  '        licenseSay(\'var(--coral)\', \'✨ Unlocked — Discover is yours. Thanks for paying for SideCut!\');',
  '        toast(\'Premium unlocked. Enjoy Discover! ✨\', 2600);',
  '        licInput.value = \'\';',
  '        return;',
  '      }',
  '      if(out.reason === \'shape\'){',
  '        licenseSay(\'var(--coral)\', \'That does not look like a license key. A gift code is SC-xxxxxxxx-xxxxxxxx and goes in the box above.\');',
  '        return;',
  '      }',
  '      if(out.reason === \'offline\'){',
  '        licenseSay(\'var(--coral)\', \'Could not reach the store to check that key — it needs the internet once, to record this device. Try again in a moment.\');',
  '        return;',
  '      }',
  '      if(out.reason === \'wrong-product\'){',
  '        licenseSay(\'var(--coral)\', \'That key is for a different product. Check that you bought SideCut.\');',
  '        return;',
  '      }',
  '      licenseSay(\'var(--coral)\', \'The store refused that key\' + (out.detail ? \': \' + out.detail : \'.\') + \' If it is a fresh purchase, give the email a moment and try again.\');',
  '    }',
  '    if(licBtn) licBtn.addEventListener(\'click\', doLicenseRedeem);',
  '    if(licInput) licInput.addEventListener(\'keydown\', (e) => { if(e.key === \'Enter\') doLicenseRedeem(); });',
]);

/* --------------------------------------------------------------------- page */
const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

sub(html, 'APP_VERSION', "const APP_VERSION = '70.0.9';", "const APP_VERSION = '70.1';",
  { key: "const APP_VERSION = '70.1';" });

const ENTRY =
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',").join('\n') + '\n' +
  '  ] },\n';
sub(html, 'the 70.1 changelog entry',
  "  const CHANGELOG = [\n  { version: '70.0.9',",
  '  const CHANGELOG = [\n' + ENTRY + "  { version: '70.0.9',",
  { key: "  { version: '70.1', date: '" });

sub(sw, 'shell cache', "const CACHE_NAME = '" + OLDCACHE + "';", "const CACHE_NAME = '" + CACHE + "';",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

sub(html, 'the licence configuration',
  "    playStoreListing: 'https://play.google.com/store/apps/details?id=com.SideCut.myapp',\n  };\n",
  "    playStoreListing: 'https://play.google.com/store/apps/details?id=com.SideCut.myapp',\n  };\n" + LICENSE_CONFIG_BLOCK,
  { key: 'const LICENSE_CONFIG = {' });

sub(html, 'the licence-key machinery',
  '  function refreshPremiumUI(){',
  LICENSE_HELPERS + '  function refreshPremiumUI(){',
  { key: "const LICENSE_INSTALL_KEY = 'sidecut_install_id';" });

sub(html, 'the plan name for a licence',
  "      const plan = info && info.plan === 'sub' ? 'subscription' : (info && info.plan === 'lifetime' ? 'lifetime' : 'gifted');",
  "      const plan = info && info.plan === 'sub' ? 'subscription' : (info && info.plan === 'lifetime' ? 'lifetime' : (info && info.plan === 'license' ? 'license' : 'gifted'));",
  { key: "info && info.plan === 'license' ? 'license' : 'gifted'" });

sub(html, 'the plan line for a licence',
  "        } else if(plan === 'lifetime'){",
  block([
    "        } else if(plan === 'license'){",
    "          planLine.textContent = 'Plan: License key — unlocked on this device.' +",
    "            (info && info.licensee ? ' · ' + info.licensee : '');",
    "        } else if(plan === 'lifetime'){",
  ]).replace(/\n$/, ''),
  { key: "planLine.textContent = 'Plan: License key" });

sub(html, 'the code-box label',
  '          <div style="font-size:11px; color:var(--ink-dim); margin-bottom:4px;">Your unlock code — tap to copy. Enter it under Redeem a code on any device to transfer premium there:</div>',
  '          <div id="premiumCodeLabel" style="font-size:11px; color:var(--ink-dim); margin-bottom:4px;">Your unlock code — tap to copy. Enter it under Redeem a code on any device to transfer premium there:</div>',
  { key: 'id="premiumCodeLabel"' });

sub(html, 'the code-box label per plan',
  block([
    '        if(info && info.code){',
    '          codeVal.textContent = info.code;',
    '          codeBox.style.display = \'block\';',
  ]),
  block([
    '        if(info && info.code){',
    '          codeVal.textContent = info.code;',
    '          codeBox.style.display = \'block\';',
    '          // One box, two kinds of unlock, and they are not interchangeable: a gift',
    '          // code is typed into Redeem a code, a licence key into its own box above,',
    '          // so the label has to say which one this is.',
    '          const codeLabel = $(\'premiumCodeLabel\');',
    '          if(codeLabel){',
    '            codeLabel.textContent = (info.plan === \'license\')',
    '              ? \'Your license key — tap to copy. Paste it under Paid by card on any device to move premium there (each device uses one activation):\'',
    '              : \'Your unlock code — tap to copy. Enter it under Redeem a code on any device to transfer premium there:\';',
    '          }',
  ]),
  { key: "const codeLabel = $('premiumCodeLabel');" });

sub(html, 'the paste-a-key box and the checkout button',
  block([
    '          <div id="premiumCodeMsg" style="font-size:12px; color:var(--ink-dim); min-height:16px; line-height:1.5;"></div>',
    '        </div>',
    '      </div>',
  ]),
  block([
    '          <div id="premiumCodeMsg" style="font-size:12px; color:var(--ink-dim); min-height:16px; line-height:1.5;"></div>',
    '        </div>',
    '',
    LICENSE_MARKUP.replace(/\n$/, ''),
    '      </div>',
  ]),
  { key: 'id="premiumLicenseInput"' });

sub(html, 'the licence-key wiring',
  "    input.addEventListener('keydown', e => { if(e.key === 'Enter') doRedeem(); });\n",
  "    input.addEventListener('keydown', e => { if(e.key === 'Enter') doRedeem(); });\n\n" + LICENSE_WIRING,
  { key: "const licInput = $('premiumLicenseInput');" });

// Both plan buttons end in the same three lines, and both must now hand over to
// the web checkout when Play cannot sell. `all` because the two tails are
// byte-identical: the subscription and the lifetime button.
sub(html, 'the Play fallback in both plan buttons',
  block([
    "      msg.style.color = 'var(--ink-dim)';",
    "      msg.textContent = 'Play billing only works inside the SideCut app installed from Google Play. Opening the Play Store so you can install it.';",
    "      try { window.open(url, '_blank', 'noopener'); } catch(e){ window.location.href = url; }",
  ]),
  '      offerLicenseOrPlayStore(msg, url);\n',
  { key: 'offerLicenseOrPlayStore(msg, url);', all: true });

sub(html, 'the licence check on launch and on focus',
  block([
    '  syncPlayEntitlement();',
    "  window.addEventListener('focus', () => { syncPlayEntitlement(); if(window.__scCheckBackgroundPlayback) window.__scCheckBackgroundPlayback(); });",
    "  document.addEventListener('visibilitychange', () => { if(!document.hidden) syncPlayEntitlement(); });",
  ]),
  block([
    '  syncPlayEntitlement();',
    '  revalidateLicense();',
    "  window.addEventListener('focus', () => { syncPlayEntitlement(); revalidateLicense(); if(window.__scCheckBackgroundPlayback) window.__scCheckBackgroundPlayback(); });",
    "  document.addEventListener('visibilitychange', () => { if(!document.hidden){ syncPlayEntitlement(); revalidateLicense(); } });",
  ]),
  { key: 'revalidateLicense();\n  window.addEventListener(\'focus\'' });

sub(html, 'the licence key in a restore',
  block([
    '            const ok = await verifyPremiumCode(manifest.premium.code);',
    '            if(ok){',
    "              setPremiumActive({ plan: manifest.premium.plan || 'gifted', code: manifest.premium.code });",
  ]),
  block([
    '            // A licence key bought on the web is not an HMAC gift code and cannot',
    '            // be verified offline - it is restored and then re-checked with the store',
    '            // on the next launch, which is how the Play purchase below behaves too.',
    '            // The difference is that this one can be revoked.',
    '            const lic = licenseShaped(manifest.premium.code);',
    '            const ok = lic || await verifyPremiumCode(manifest.premium.code);',
    '            if(ok){',
    '              setPremiumActive(lic',
    "                ? { plan: 'license', code: manifest.premium.code, source: 'license', checked: 0 }",
    "                : { plan: manifest.premium.plan || 'gifted', code: manifest.premium.code });",
  ]),
  { key: 'const lic = licenseShaped(manifest.premium.code);' });

sub(html, 'the activation handed back on removal',
  "      card.querySelector('.confirm').addEventListener('click', function(){ backdrop.remove(); clearPremium(); });",
  "      card.querySelector('.confirm').addEventListener('click', function(){ backdrop.remove(); releaseLicenseActivation(); clearPremium(); });",
  { key: 'releaseLicenseActivation(); clearPremium();' });

sub(html, 'the licence hooks for the release probe',
  '  window.__scCropSong = function(id){',
  block([
    '  // The licence path lives inside the app IIFE, so the release probe reaches it',
    '  // through the same bridge the other 70.x hooks use.',
    '  window.__scLicenseRedeem = function(key){ return activateLicenseKey(key); };',
    '  window.__scLicenseCheck = function(){ return revalidateLicense(); };',
    '  window.__scCropSong = function(id){',
  ]).replace(/\n$/, ''),
  { key: 'window.__scLicenseRedeem = function(key){' });

/* ============================================ the gate that reads the notes */
// test-662 asserts that the head entry describes a real release by looking for a
// word from a list of surfaces - which was true of 70.0 through 70.0.9 and would
// be false of 70.1, a release about how the app is paid for. The rule underneath
// it is "the notes name a surface this app actually has", so the list gains the
// paid surface rather than being dropped, or satisfied by writing the word dock
// into notes about licensing.
const t662 = holder(fs.readFileSync(TEST662, 'utf8'));
sub(t662, 'test-662 the notes name a real surface',
  "    // 70.0.9 is about the player and the dock, and the rule underneath the word\n" +
  "    // is that the notes name a surface this app really has - not one in particular.\n" +
  "    ok(/(studio|player|dock)/i.test(head.items.join('\\n')),\n" +
  "      'and it describes what this release did');",
  "    // 70.0.9 was about the player and the dock, and 70.1 is about how the app is\n" +
  "    // paid for: the rule underneath the word is that the notes name a surface this\n" +
  "    // app really has, not one in particular, so the list grows with the app.\n" +
  "    ok(/(studio|player|dock|premium|license)/i.test(head.items.join('\\n')),\n" +
  "      'and it describes what this release did');",
  { key: '/(studio|player|dock|premium|license)/i' });

/* ================================= the gate that pins the 70.0 series itself */
// test-70 is the 70.0 gate and it DESCRIBES 70.0 - which is why its VER is '70.0'
// and did not move here. But its "the build on the page" rule said the page must
// BE 70.0 or a patch on it, and 70.1 is the series the page's own rule says
// follows 70.0.9 ("the third number stops at nine: 60.0.9 is followed by 60.1,
// never 60.0.10"). The rule is widened to that successor, and the second pin -
// a literal in the regex - is replaced by the rule the page states about itself:
// the third number never reaches ten and a new series does not read 70.1.0.
const t70 = holder(fs.readFileSync(TEST70, 'utf8'));
sub(t70, 'test-70 the series restart',
  block([
    '  // The build on the page is 70.0 or a patch on it; the release this gate',
    '  // DESCRIBES is still 70.0, which is why VER did not move with APP_VERSION.',
    "  ok(ver === VER || String(ver).indexOf(VER + '.') === 0,",
    "     'the app runs as ' + VER + ' or a patch on it (' + ver + ')');",
    "  ok(/const APP_VERSION = '70\\.0(\\.\\d+)?';/.test(src),",
    "     'and the version is a 70.0 series number, never a 70.0.0 cascade');",
  ]),
  block([
    '  // The build on the page is 70.0, a patch on it, or the series the page own',
    '  // rule says follows it - 70.1, because "the third number stops at nine: 60.0.9',
    '  // is followed by 60.1, never 60.0.10". The release this gate DESCRIBES is',
    '  // still 70.0, which is why VER did not move with APP_VERSION.',
    "  ok(ver === VER || String(ver).indexOf(VER + '.') === 0 || /^70\\.1(\\.\\d+)?$/.test(ver),",
    "     'the app runs as ' + VER + ', a patch on it, or the series that follows it (' + ver + ')');",
    '  // The rule the page states about its own version rather than a literal: the',
    '  // series is 70.x, the third number stops at nine, and a new series does not',
    '  // read 70.1.0 - so 70.0.10 and 70.1.0 are both refused.',
    "  const verParts = String(ver).split('.').map((n) => Number(n));",
    "  ok(/^70\\.\\d+(\\.\\d+)?$/.test(ver) &&",
    '     !(verParts.length === 3 && (verParts[2] === 0 || verParts[2] > 9)),',
    "     'and the version is a 70.x number whose third number never reaches ten');",
  ]),
  { key: 'or the series that follows it' });

/* ================================================================== the gate */
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
sub(t705, 'test-705 the 70.1 rules',
  "  mustStillReserve(src, '.action-strip');",
  "  mustStillReserve(src, '.action-strip');\n" +
  '  // 70.1. Paying for the APK: a key bought on the web, checked by the store,\n' +
  '  // kept offline. The rules are about what must NOT be in the file, and about\n' +
  '  // what must never happen to somebody who has already paid.\n' +
  "  ok(has('const LICENSE_CONFIG = {'), 'the web checkout is not configured in the app');\n" +
  "  ok(has(\"validateUrl: 'https://api.lemonsqueezy.com/v1/licenses/validate'\") &&\n" +
  "     has(\"activateUrl: 'https://api.lemonsqueezy.com/v1/licenses/activate'\") &&\n" +
  "     has(\"deactivateUrl: 'https://api.lemonsqueezy.com/v1/licenses/deactivate'\"),\n" +
  "     'and it does not point at a store licence API');\n" +
  "  ok(has('NOTHING SECRET GOES IN THIS OBJECT') &&\n" +
  "     !/LEMONSQUEEZY_API_KEY|LEMON_SQUEEZY_API_KEY/i.test(src),\n" +
  "     'and no store secret is shipped in the page (the endpoints need none)');\n" +
  "  ok(count(\"licensePost(LICENSE_CONFIG.activateUrl\") === 1 &&\n" +
  "     count(\"licensePost(LICENSE_CONFIG.validateUrl\") === 1,\n" +
  "     'a key is activated against the store and validated against it');\n" +
  "  ok(count('instance_name: licenseInstanceName()') === 1,\n" +
  "     'and the device is recorded as an activation, so a device limit means something');\n" +
  "  ok(count('// unreachable store: the unlock stays, untouched') === 1,\n" +
  "     'a store that cannot be reached must never lock a paying user out');\n" +
  "  ok(count(\"if(data.valid === false){\") === 1 && count('clearPremiumQuietly();') >= 2,\n" +
  "     'only the store saying not valid can take the unlock away');\n" +
  "  ok(count('offerLicenseOrPlayStore(msg, url);') === 2,\n" +
  "     'both Play buttons hand over to the web checkout when Play cannot sell');\n" +
  "  ok(count('id=\"premiumLicenseInput\"') === 1 && count('id=\"premiumLicenseBtn\"') === 1 &&\n" +
  "     count('id=\"premiumLicenseBuyBtn\"') === 1,\n" +
  "     'and the pane offers both halves: the checkout and the box to paste the key in');\n" +
  "  ok(has('The web checkout is not open yet'),\n" +
  "     'an unset checkout link says so instead of opening a dead link');\n" +
  "  ok(count('releaseLicenseActivation(); clearPremium();') === 1,\n" +
  "     'removing premium gives the activation back to the store');\n" +
  "  ok(count(\"const PREMIUM_HMAC_KEY_B64 = \") === 1 && count(\"parts[0] !== 'SC'\") === 1,\n" +
  "     'and the gift-code path is exactly where it was');\n" +
  "  ok(count('id=\"premiumLicenseMsg\"') === 1,\n" +
  "     'and the pane can say what the store answered');\n" +
  "  ok(count(\"'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'\") === 1,\n" +
  "     'and the only thing sent with a key is the key itself');\n" +
  "  ok(count('new URLSearchParams()') === 1, 'and the body is encoded like the form it is');",
  { key: 'the web checkout is not configured in the app' });

// This tree already carries the 70.1 rules in test-705 (they were applied by the
// first cut of this release, which was one assertion short - the form-body rule
// came from the URLSearchParams correction afterwards), so the sub above skips
// and the missing line has to be added. Guarded on the assertion itself and not
// on a version marker, so it can never double up on either kind of tree.
if(count(t705.text, 'and the body is encoded like the form it is') === 0 &&
   count(t705.text, "'and the only thing sent with a key is the key itself');") === 1){
  t705.text = t705.text.replace(
    "     'and the only thing sent with a key is the key itself');",
    "     'and the only thing sent with a key is the key itself');\n" +
    "  ok(count('new URLSearchParams()') === 1, 'and the body is encoded like the form it is');");
  applied++;
}

const studio = holder(fs.readFileSync(STUDIO, 'utf8'));
sub(studio, 'studio-70-check the 70.1 rules',
  "  console.log('[12] the page still holds together');",
  '  console.log(\'[11c] a license key bought on the web unlocks without Google Play\');\n' +
  '  {\n' +
  '    // 70.1 - "APK payment: License key + web checkout". jsdom has no store on the\n' +
  '    // other end, so fetch is stubbed with the answers the store really gives\n' +
  '    // (checked against the live API: a refusal is a 404 with {"valid":false,\n' +
  '    // "error":"license_key not found."} in the body). What is driven is the rule\n' +
  '    // that matters: a real answer unlocks, a refusal does not, and a store that\n' +
  '    // cannot be reached never takes anything away.\n' +
  '    ok(!!doc.querySelector(\'#premiumLicenseInput\'), \'the paste-a-key box is in the pane\');\n' +
  '    ok(!!doc.querySelector(\'#premiumLicenseBtn\'), \'with a button to redeem it\');\n' +
  '    ok(!!doc.querySelector(\'#premiumLicenseBuyBtn\'), \'and a button that opens the checkout\');\n' +
  '    // typeof, not instanceof Function: the app runs in the jsdom realm, so its\n' +
  '    // functions are not instances of this file\'s Function.\n' +
  '    ok(typeof win.__scLicenseRedeem === \'function\' && typeof win.__scLicenseCheck === \'function\',\n' +
  '      \'and the path is reachable for a probe\');\n' +
  '    const realFetch = win.fetch;\n' +
  '    const KEY = \'38b1460a-5104-4067-a91d-77b872934d51\';\n' +
  '    let sent = null;\n' +
  '    win.localStorage.removeItem(\'sidecut_premium\');\n' +
  '    const answer = (data) => { win.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) }); };\n' +
  '    const refuse = (msg) => { win.fetch = (url, opts) => { sent = { url: url, body: String(opts && opts.body) };\n' +
  '      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ valid: false, activated: false, error: msg, license_key: null, instance: null, meta: null }) }); }; };\n' +
  '    refuse(\'license_key not found.\');\n' +
  '    const shape = await win.__scLicenseRedeem(\'SC-WPd5Wafj-YFdlBz3Z\');\n' +
  '    ok(shape.ok === false && shape.reason === \'shape\', \'a gift code is not handed to the store as a key\');\n' +
  '    ok(sent === null, \'and the store is never asked about it\');\n' +
  '    const bad = await win.__scLicenseRedeem(\'00000000-0000-0000-0000-000000000000\');\n' +
  '    ok(bad.ok === false && bad.reason === \'refused\', \'a key the store refuses does not unlock\');\n' +
  '    ok(win.isPremiumActive() === false, \'and premium stays off\');\n' +
  '    ok(!!sent && /\\/licenses\\/activate$/.test(sent.url), \'the key is handed to the activate endpoint\');\n' +
  '    ok(/license_key=0/.test(sent.body) && /instance_name=SideCut\\+/.test(sent.body),\n' +
  '      \'with the key and this device named as the activation\');\n' +
  '    ok(!/api[-_]?key=/i.test(sent.body), \'and with no secret of ours anywhere in the request\');\n' +
  '    win.fetch = () => Promise.reject(new Error(\'offline\'));\n' +
  '    const offline = await win.__scLicenseRedeem(KEY);\n' +
  '    ok(offline.ok === false && offline.reason === \'offline\', \'a store that cannot be reached does not unlock\');\n' +
  '    ok(win.isPremiumActive() === false, \'and does not unlock by accident either\');\n' +
  '    answer({ activated: true, error: null, license_key: { id: 1, status: \'active\', activation_limit: 3 },\n' +
  '      instance: { id: \'inst-1\', name: \'SideCut node 3f9a2b\' },\n' +
  '      meta: { store_id: 1, product_id: 2, customer_email: \'buyer@example.com\' } });\n' +
  '    const good = await win.__scLicenseRedeem(KEY);\n' +
  '    ok(good.ok === true, \'a key the store activates unlocks\');\n' +
  '    ok(win.isPremiumActive() === true, \'premium is on\');\n' +
  '    const rec = JSON.parse(win.localStorage.getItem(\'sidecut_premium\') || \'{}\');\n' +
  '    ok(rec.plan === \'license\' && rec.code === KEY, \'as a license key, kept so it can move to the next phone\');\n' +
  '    ok(rec.instance === \'inst-1\', \'and with the activation the store handed back\');\n' +
  '    rec.checked = 0;\n' +
  '    win.localStorage.setItem(\'sidecut_premium\', JSON.stringify(rec));\n' +
  '    win.fetch = () => Promise.reject(new Error(\'offline\'));\n' +
  '    ok((await win.__scLicenseCheck()) === false, \'a re-check that cannot reach the store returns nothing\');\n' +
  '    ok(win.isPremiumActive() === true, \'and a paying user keeps what they paid for\');\n' +
  '    answer({ valid: false, error: \'license_key not found.\', license_key: null, instance: null, meta: null });\n' +
  '    ok((await win.__scLicenseCheck()) === true, \'and a key the store no longer knows is checked\');\n' +
  '    ok(win.isPremiumActive() === false, \'which locks it, the way a refund should\');\n' +
  '    answer({ valid: true, error: null, license_key: { status: \'active\' }, instance: null, meta: {} });\n' +
  '    win.localStorage.setItem(\'sidecut_premium\', JSON.stringify({ active: true, plan: \'license\', code: KEY, instance: \'inst-1\', checked: 0 }));\n' +
  '    ok((await win.__scLicenseCheck()) === true && win.isPremiumActive() === true, \'and a renewed key stays unlocked\');\n' +
  '    if(realFetch) win.fetch = realFetch; else delete win.fetch;\n' +
  '  }\n' +
  '\n' +
  "  console.log('[12] the page still holds together');",
  { key: "console.log('[11c] a license key bought on the web unlocks without Google Play');" });

/* ------------------------------------------------------------------- healed */
// The first cut of this release built the licence form body with
// encodeURIComponent, which sends a space as %20 rather than the + a form body
// uses for one. Both are legal and the store reads both, but the app should send
// what a browser form sends, so the tree in front of this patch is healed onto
// URLSearchParams. On a tree built from the constants above there is nothing to
// heal - which is why this is heal() and not sub().
heal(html, 'the licence form body',
  block([
    '    const body = Object.keys(fields)',
    "      .filter((k) => fields[k] !== undefined && fields[k] !== null && fields[k] !== '')",
    "      .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(fields[k]))",
    "      .join('&');",
  ]),
  block([
    '    // URLSearchParams, because this is a form body: a space in the activation',
    '    // name has to go out as a + the way a browser form sends it, and it is the',
    '    // one encoder that is right about that everywhere.',
    '    const params = new URLSearchParams();',
    '    Object.keys(fields).forEach((k) => {',
    "      if(fields[k] === undefined || fields[k] === null || fields[k] === '') return;",
    '      params.append(k, fields[k]);',
    '    });',
    '    const body = params.toString();',
  ]));

// Same reason: the probe ran against the first cut, which asked whether the
// app's functions were instances of ITS Function. The app runs in the jsdom
// realm, so they never are.
heal(studio, 'the probe realm check',
  "    ok(win.__scLicenseRedeem instanceof Function && win.__scLicenseCheck instanceof Function,\n",
  block([
    '    // typeof, not instanceof Function: the app runs in the jsdom realm, so its',
    "    // functions are not instances of this file's Function.",
    "    ok(typeof win.__scLicenseRedeem === 'function' && typeof win.__scLicenseCheck === 'function',",
  ]));

/* ------------------------------------------------------------------- checks */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  must(count(page, "const APP_VERSION = '70.1';") === 1, 'the version is not 70.1 exactly once');
  must(count(page, "version: '70.1'") === 1, 'the 70.1 changelog entry is missing');
  must(count(page, "date: 'September 29, 2026 \u00b7 4:11 PM EDT'") === 1,
    'the 70.1 stamp is not the one this release was cut at');
  must(count(page, "version: '70.0.9'") === 1, 'the 70.0.9 entry left the array');
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, "const CACHE_NAME = '" + OLDCACHE + "';") === 0, 'the old shell cache is still in sw.js');

  // The paying path, and the three things it must never do: ship a secret, lock
  // a paying user out because the store was unreachable, or leave the Play path
  // and the gift codes any different to how they were.
  must(count(page, 'const LICENSE_CONFIG = {') === 1, 'the licence configuration is missing');
  must(count(page, "checkoutUrl: '',") === 1, 'the checkout link is not the single line left to fill in');
  must(!/LEMONSQUEEZY_API_KEY|LEMON_SQUEEZY_API_KEY/i.test(page), 'a store secret was shipped in the page');
  must(count(page, 'function activateLicenseKey(key){') === 1, 'nothing redeems a key');
  must(count(page, 'function revalidateLicense(){') === 1, 'and nothing re-checks one');
  must(count(page, 'const params = new URLSearchParams();') === 1,
    'the licence form body is not built like the form it is');
  must(count(page, '// unreachable store: the unlock stays, untouched') === 1,
    'a failed lookup is not the safe one any more');
  must(count(page, 'offerLicenseOrPlayStore(msg, url);') === 2, 'a Play button no longer offers the checkout');
  must(count(page, 'id="premiumLicenseInput"') === 1, 'the paste-a-key box is not on the page');
  must(count(page, 'releaseLicenseActivation(); clearPremium();') === 1, 'the activation is never handed back');
  must(count(page, "const PREMIUM_HMAC_KEY_B64 = ") === 1, 'the gift-code key left the page');
  must(count(page, "parts[0] !== 'SC'") === 1, 'the gift-code verifier left the page');
  must(count(page, 'window.__scLicenseRedeem = function(key){') === 1, 'the probe hook is missing');
  must(count(page, 'syncPlayEntitlement();\n  revalidateLicense();') === 1,
    'the licence is not re-checked on launch');

  must(count(t705.text, 'the web checkout is not configured in the app') === 1,
    'test-705 does not assert the release');
  must(count(t705.text, 'and the body is encoded like the form it is') === 1,
    'test-705 does not assert the form body it sends');
  must(count(studio.text, "console.log('[11c] a license key bought on the web unlocks without Google Play');") === 1,
    'the real-app probe does not assert the licence path');
  must(count(t662.text, '/(studio|player|dock|premium|license)/i') === 1,
    'test-662 still insists every release names a surface this app has');
  must(count(t70.text, 'or the series that follows it') === 1,
    'test-70 still refuses the series that follows 70.0.9');
}

if(problems.length){
  console.error('patch-701: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(MANIFEST){
  const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(built));
  console.log('patch-701: root manifest.json seeded from ota/updates.json (' + built.size + ' bytes)');
  process.exit(0);
}

if(CHECK){
  console.log('patch-701: tree is at ' + VERSION + ', ' + applied + ' to apply, ' + already + ' already in place');
  process.exit(0);
}

const files = [[IDX, html.text], [SW, sw.text], [TEST705, t705.text], [STUDIO, studio.text], [TEST662, t662.text], [TEST70, t70.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-701: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-701: next `node dev/repin-701.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
