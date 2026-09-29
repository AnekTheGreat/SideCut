#!/usr/bin/env node
/**
 * Check a licence key from the terminal, the way the app checks it.
 *
 * This is the dev-side half of the web checkout: it speaks to the same store
 * endpoints the app does (LICENSE_CONFIG in index.html), so a key can be tested
 * before a customer ever pastes it. Nothing secret is needed - the store's
 * customer-facing licence API takes nothing but the key itself, which is the
 * whole reason a static app can use it.
 *
 *   node dev/license-check.mjs validate <key> [instance-id]
 *   node dev/license-check.mjs activate <key> [instance-name]
 *   node dev/license-check.mjs deactivate <key> <instance-id>
 *
 * Exits 0 when the store says the key is good, 1 when it says otherwise (the
 * store's own message is printed), 2 on a bad invocation.
 */
const VALIDATE = 'https://api.lemonsqueezy.com/v1/licenses/validate';
const ACTIVATE = 'https://api.lemonsqueezy.com/v1/licenses/activate';
const DEACTIVATE = 'https://api.lemonsqueezy.com/v1/licenses/deactivate';

const [action, key, extra] = process.argv.slice(2);
const urls = { validate: VALIDATE, activate: ACTIVATE, deactivate: DEACTIVATE };

if (!action || !urls[action] || !key) {
  console.error('usage: node dev/license-check.mjs validate|activate|deactivate <key> [instance]');
  process.exit(2);
}

const fields = { license_key: key };
if (action === 'validate' && extra) fields.instance_id = extra;
if (action === 'activate') fields.instance_name = extra || 'SideCut terminal check';
if (action === 'deactivate' && extra) fields.instance_id = extra;

const body = Object.keys(fields)
  .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(fields[k]))
  .join('&');

let res, data;
try {
  res = await fetch(urls[action], {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  data = await res.json();
} catch (e) {
  console.error('could not reach the store: ' + e.message);
  process.exit(1);
}

const good = (action === 'activate') ? data.activated === true
  : (action === 'deactivate') ? data.deactivated === true
    : data.valid === true;

if (data.meta) {
  console.log('  store:   ' + data.meta.store_id + '   product: ' + data.meta.product_id + '   ' + (data.meta.product_name || ''));
  if (data.meta.customer_email) console.log('  customer: ' + data.meta.customer_email);
}
if (data.license_key) {
  const lk = data.license_key;
  console.log('  status:  ' + lk.status + '   activations: ' + lk.activation_usage + '/' + lk.activation_limit +
    (lk.expires_at ? '   expires: ' + lk.expires_at : '   never expires'));
}
if (data.instance) console.log('  instance: ' + data.instance.id + '  (' + data.instance.name + ')');

if (good) {
  console.log('\n' + action + ': OK (' + res.status + ')');
  if (action === 'validate' && data.instance === null) {
    console.log('note: no instance_id was given (or the key has no activation on this device yet).');
  }
  process.exit(0);
}

console.error('\n' + action + ': refused (' + res.status + ') - ' + (data.error || 'no reason given'));
process.exit(1);
