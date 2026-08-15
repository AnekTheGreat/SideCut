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

## Premium / dev code system (v44.1; codes shortened in v44.2)
- Discover is premium: $10 lifetime OR $0.49/2-weeks subscription (opens dev checkout links).
- Dev-gifted codes unlock premium for free: format `SC-<8 base62 nonce>-<8 base62 HMAC tag>`
  (~20 chars), signed message = ASCII "SC-<nonce>", HMAC-SHA256, verified client-side via
  Web Crypto against embedded `PREMIUM_HMAC_KEY_B64`.
- The embedded HMAC key is a one-way SHA-256 of the dev's private PEM (in
  `dev/premium-private-key.pem`, gitignored) — extracting it from JS does NOT reveal the PEM.
- Generate codes with `node dev/make-premium-code.js [count]`.
- Earlier v44.1 used full Ed25519 signatures (146-char codes); v44.2 switched to HMAC for
  short, easy-to-type codes. The PEM is unchanged, so the same generator/key works.
- Premium state stored in `localStorage['sidecut_premium']` = JSON `{active, granted, plan, ...}`.
- If you ever regenerate the PEM, recompute PREMIUM_HMAC_KEY_B64 (SHA-256 of PEM, base64)
  and update it in index.html AND dev/premium-private-key.pem together.

## Gotchas / past bugs
- `#library` CSS default is `display:none`; it's shown elsewhere via `display='flex'`.
  So toggling Discover off must restore `'flex'`, NOT `''` (which hides it). Done in v44.2.
- `.action-strip` needs `flex-wrap:wrap` so action-pill names aren't clipped (pills are
  `flex-shrink:0; white-space:nowrap`). Done in v44.2.

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
