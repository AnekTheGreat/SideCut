## 83.2.4 ({{STAMP}}): UNote moved to its own place

- **WHAT CHANGED.** The UNote card in Settings → Other apps opens `https://anekthegreat.github.io/UNote/` instead of the host it was first tried on. Same card, same wording, same Open it.
- **WHY.** UNote lives in its own repository now, and that repository publishes both the page and an APK, rebuilt on every push. A card that pointed at a host which was only ever a stopover would rot the moment that host changed.
- **CHECKS.** `dev/patch-8324.py --check` exits 1 before the payload and 0 after it, a second run changes nothing, and the page diff is four lines: the card's `href` and `APP_VERSION`. The card sits inside `#settingsPaneOther`, and the wording around it - `Four more`, `Open it` - is untouched. Rebuilt bundles: {{ROOT}} bytes on the full channel, {{PLAY}} on the store build.
- **NOT CLAIMED.** No phone has tapped the new link. What is proven is that the page the OTA delivers carries the repository URL, and that the repository URL is the app.
