// Generate short SideCut premium unlock codes that work offline, with no backend.
//
// Codes look like  SC-WPd5Wafj-YFdlBz3Z  (~20 chars, easy to type/read).
// They are HMAC-SHA256 tags: the app embeds only the derived HMAC key (a one-way
// SHA-256 of this private key PEM, so extracting it from the app does NOT reveal
// the private key itself). Only this script — which holds the source PEM — can
// mint valid codes. Give each code to one person.
//
// Usage:
//   node dev/make-premium-code.js            # one code
//   node dev/make-premium-code.js 5          # five codes

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, 'premium-private-key.pem');
if (!fs.existsSync(KEY_PATH)) {
  console.error('Missing dev/premium-private-key.pem.');
  process.exit(1);
}

const pem = fs.readFileSync(KEY_PATH, 'utf8');
// Derived HMAC key — must match PREMIUM_HMAC_KEY_B64 in index.html.
const hmacKey = crypto.createHash('sha256').update(pem).digest();

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function b62of(buf) {
  let n = BigInt('0x' + Buffer.from(buf).toString('hex'));
  let s = '';
  while (n > 0n) { s = B62[Number(n % 62n)] + s; n /= 62n; }
  return s;
}
function tagFor(nonce) {
  const msg = Buffer.from('SC-' + nonce, 'utf8');
  const tag = crypto.createHmac('sha256', hmacKey).update(msg).digest();
  return b62of(tag).padStart(8, '0').slice(-8);
}

const count = Math.max(1, parseInt(process.argv[2], 10) || 1);
for (let i = 0; i < count; i++) {
  const nonce = b62of(crypto.randomBytes(6)).padStart(8, '0').slice(-8);
  console.log('SC-' + nonce + '-' + tagFor(nonce));
}
