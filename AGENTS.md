# SideCut — repository memory

## What this is
SideCut is a single-file PWA music player (`index.html`) + a service worker (`sw.js`).
Everything (HTML/CSS/JS) lives in `index.html`. Versioning: `APP_VERSION` + `CHANGELOG`
array (~line 5136) and `sw.js` `CACHE_NAME = 'sidecut-shell-vNN.N'` — bump BOTH on every
change. The user prefers version bumps of .1 (patch) and dates in EDT.

## Key landmarks in index.html
- Settings modal `#themeBackdrop` / `.modal` ~line 1462; tab strip `#settingsTabStrip` ~1466
- Settings panes: `#settingsPanePremium`, `#settingsPaneTheme`, `#settingsPaneDonate`, Glow,
  Playback, EQ, Download, More, Sandbox. `showSettingsTab(tab)` toggles them ~line 3396.
- PAID FEATURES module ~line 3160: `PAYMENT_CONFIG` (checkout/donation links),
  `PREMIUM_PUBKEY_B64`, `isPremiumActive()`, `verifyPremiumCode()`, `initPremiumTab()`,
  `initDonateTab()`, `openPremiumSettings()`. All inside the main IIFE (2599→12131).
- Discover: `showDiscover(on)` ~line 11720, `discoverBtn` click handler ~11985 (gated on premium).
- `toast(msg, ms)` helper ~line 2552.

## Premium / dev code system (added v44.1)
- Discover is premium: $10 lifetime OR $0.49/2-weeks subscription (opens dev checkout links).
- Dev-gifted codes unlock premium for free: format `SC-<16hex nonce>-<128hex ed25519 sig>`,
  signed message = ASCII "SC-<nonce>", verified client-side with Web Crypto Ed25519 against
  the embedded public key `PREMIUM_PUBKEY_B64`.
- Private key lives ONLY in `dev/premium-private-key.pem` (gitignored). Generate codes with
  `node dev/make-premium-code.js [count]`. The private key is generated separately and must
  never be committed or embedded in the app.
- Premium state stored in `localStorage['sidecut_premium']` = JSON `{active, granted, plan, ...}`.
- If you ever regenerate the keypair, update `PREMIUM_PUBKEY_B64` in index.html AND
  `dev/premium-private-key.pem` together.

## Verification tips
- Parse-check all inline scripts: `node -e` with a regex extracting `<script>` blocks (no src)
  and `new Function(src)` each. Two inline blocks exist.
- Web Crypto Ed25519 verify logic can be unit-tested in Node via `require('crypto').webcrypto.subtle`
  — identical API to the browser. Valid code → true, tampered/garbage → false.
- Dev server for browser testing: `python3 -m http.server 12000` then
  `https://work-1-gjowoesfeonmvpdw.prod-runtime.all-hands.dev/` (proxies 12000).
  Note: a stale service worker can block updates — unregister SW / hard reload to see new code.

## Git / deploy
- Remote: https://github.com/AnekTheGreat/SideCut.git, branch `main`.
- Commit with `Co-authored-by: openhands <openhands@all-hands.dev>`.
- The user generally says "push" — they want commits pushed to main.
