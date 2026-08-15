// Generate SideCut premium unlock codes that work offline, with no backend.
//
// The app embeds only the Ed25519 PUBLIC key (see PREMIUM_PUBKEY_B64 in index.html).
// This file holds the matching PRIVATE key (gitignored — never commit it, never put
// it in the app). Running `node dev/make-premium-code.js` signs a fresh random code
// that the app will accept. Give each code to one person. Codes can't be forged
// without this private key.
//
// Usage:
//   node dev/make-premium-code.js            # one code
//   node dev/make-premium-code.js 5          # five codes

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, 'premium-private-key.pem');
if (!fs.existsSync(KEY_PATH)) {
  console.error('Missing dev/premium-private-key.pem. Generate one with:');
  console.error('  node -e "require(\'crypto\').generateKeyPairSync(\'ed25519\')" ...');
  console.error('and keep its private key here, public key in index.html (PREMIUM_PUBKEY_B64).');
  process.exit(1);
}

const pem = fs.readFileSync(KEY_PATH, 'utf8');
const priv = crypto.createPrivateKey(pem);

const count = Math.max(1, parseInt(process.argv[2], 10) || 1);
for (let i = 0; i < count; i++) {
  const nonce = crypto.randomBytes(8).toString('hex');
  const msg = Buffer.from('SC-' + nonce, 'utf8');
  const sig = crypto.sign(null, msg, priv);
  console.log('SC-' + nonce + '-' + sig.toString('hex'));
}
